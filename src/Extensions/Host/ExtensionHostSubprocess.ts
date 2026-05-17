import { Module, createRequire } from "node:module";

import type { IDisposable } from "../../Common/Disposable.ts";

import type { IIpcEndpoint } from "./IpcMessageChannel.ts";
import { IpcMessageChannel } from "./IpcMessageChannel.ts";
import { RpcEndpoint } from "./RpcEndpoint.ts";
import { buildVscodeNamespace } from "./VscodeNamespace.ts";

/**
 * Сообщения protocol host -> subprocess. RPC-методы:
 *
 * - `host.activateExtension({ id, mainPath })` -> `null`. Загружает CJS-модуль
 *   через `createRequire`, вызывает `module.activate(context)`. Бросает на
 *   ошибках загрузки/активации.
 * - `host.deactivateExtension({ id })` -> `null`. Вызывает `deactivate()` +
 *   disposes `context.subscriptions`. Idempotent.
 * - `host.shutdown()` -> `null`. Снимает все расширения и инициирует exit.
 *
 * Subprocess -> host RPC:
 *   `editor.setOptions`, `editor.getOptions` (см. `buildVscodeNamespace`).
 */

interface ActivatedExtension {
    readonly id: string;
    readonly mod: ExtensionModule;
    readonly context: ExtensionContext;
}

interface ExtensionModule {
    activate?: (context: ExtensionContext) => unknown | Promise<unknown>;
    deactivate?: () => unknown | Promise<unknown>;
}

interface ExtensionContext {
    readonly subscriptions: { dispose: () => unknown }[];
}

/**
 * Точка входа в subprocess extension host'а. Вызывается из `main.ts` при
 * обнаружении env-флага `VEXX_EXTENSION_HOST=1`. НИКОГДА не возвращает в
 * нормальном режиме — процесс живёт до `host.shutdown` или `disconnect`.
 */
export async function runExtensionHostSubprocess(): Promise<void> {
    if (typeof process.send !== "function") {
        // Без IPC-канала смысла нет. Завершаемся, чтобы не висеть мёртвым.
        // eslint-disable-next-line no-console
        console.error("[ext-host] subprocess started without IPC channel; exiting");
        process.exit(2);
    }

    const channel = new IpcMessageChannel(process as unknown as IIpcEndpoint);
    const rpc = new RpcEndpoint(channel);

    installVscodeStub(rpc);

    const extensions = new Map<string, ActivatedExtension>();

    rpc.handleRequest("host.activateExtension", async (params): Promise<unknown> => {
        const { id, mainPath } = parseActivateParams(params);
        if (extensions.has(id)) {
            throw new Error(`Extension "${id}" already activated`);
        }
        const extRequire = createRequire(mainPath);
        const loaded = extRequire(mainPath) as ExtensionModule;
        if (typeof loaded.activate !== "function") {
            throw new Error(`Extension "${id}" has no activate() in ${mainPath}`);
        }
        const context: ExtensionContext = { subscriptions: [] };
        const active: ActivatedExtension = { id, mod: loaded, context };
        extensions.set(id, active);
        try {
            await loaded.activate(context);
        } catch (err) {
            extensions.delete(id);
            throw err;
        }
        return null;
    });

    rpc.handleRequest("host.deactivateExtension", async (params): Promise<unknown> => {
        const id = parseExtensionId(params);
        const active = extensions.get(id);
        if (active === undefined) return null;
        extensions.delete(id);
        await deactivate(active);
        return null;
    });

    rpc.handleRequest("host.shutdown", async (): Promise<unknown> => {
        await shutdown();
        return null;
    });

    const shutdownOnce = (): void => {
        void shutdown().finally(() => process.exit(0));
    };
    process.once("disconnect", shutdownOnce);
    process.once("SIGTERM", shutdownOnce);
    process.once("SIGINT", shutdownOnce);

    async function shutdown(): Promise<void> {
        const all = [...extensions.values()];
        extensions.clear();
        for (const active of all) {
            try {
                await deactivate(active);
            } catch {
                // глотаем — мы уже завершаемся
            }
        }
        rpc.dispose();
        channel.dispose();
    }

    // Сигнал готовности parent'у: можно слать activateExtension.
    rpc.notify("host.ready", null);
}

async function deactivate(active: ActivatedExtension): Promise<void> {
    try {
        await active.mod.deactivate?.();
    } finally {
        for (const sub of active.context.subscriptions.splice(0).reverse()) {
            try {
                sub.dispose();
            } catch {
                // глотаем
            }
        }
    }
}

function parseActivateParams(raw: unknown): { id: string; mainPath: string } {
    if (typeof raw !== "object" || raw === null) {
        throw new Error("activateExtension: params must be an object");
    }
    const obj = raw as { id?: unknown; mainPath?: unknown };
    if (typeof obj.id !== "string" || obj.id === "") {
        throw new Error("activateExtension: id must be a non-empty string");
    }
    if (typeof obj.mainPath !== "string" || obj.mainPath === "") {
        throw new Error("activateExtension: mainPath must be a non-empty string");
    }
    return { id: obj.id, mainPath: obj.mainPath };
}

function parseExtensionId(raw: unknown): string {
    if (typeof raw !== "object" || raw === null) {
        throw new Error("deactivateExtension: params must be an object");
    }
    const obj = raw as { id?: unknown };
    if (typeof obj.id !== "string" || obj.id === "") {
        throw new Error("deactivateExtension: id must be a non-empty string");
    }
    return obj.id;
}

/**
 * Регистрирует виртуальный модуль `"vscode"` в кэше Node CJS-loader'а, чтобы
 * `require("vscode")` внутри расширения возвращал host-backed namespace.
 *
 * Используем приватные API `Module._cache` и `Module._resolveFilename` —
 * стандартный приём расширений Node и оригинальный приём VS Code.
 */
function installVscodeStub(rpc: RpcEndpoint): IDisposable {
    const vscodeNs = buildVscodeNamespace(rpc);
    const moduleAny = Module as unknown as {
        _cache: Record<string, { exports: unknown; loaded: boolean; id: string; filename: string }>;
        _resolveFilename: (request: string, parent: unknown, ...rest: unknown[]) => string;
    };

    const cacheKey = "vscode";
    moduleAny._cache[cacheKey] = {
        id: cacheKey,
        filename: cacheKey,
        loaded: true,
        exports: vscodeNs,
    };

    const origResolve = moduleAny._resolveFilename;
    moduleAny._resolveFilename = function (request: string, parent: unknown, ...rest: unknown[]): string {
        if (request === "vscode") return cacheKey;
        return origResolve.call(this, request, parent, ...rest);
    };

    return {
        dispose: (): void => {
            moduleAny._resolveFilename = origResolve;
            delete moduleAny._cache[cacheKey];
        },
    };
}
