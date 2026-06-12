import { type ChildProcess, spawn } from "node:child_process";
import { createRequire } from "node:module";

import { token } from "../../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../../Common/Disposable.ts";
import type { ILogger } from "../../Common/Logging/ILogger.ts";

import type { IEditorOptionsPatch, IEditorOptionsService } from "./IEditorOptionsService.ts";
import type { IExtensionRegistration } from "./IExtensionEntry.ts";
import type { IIpcEndpoint } from "./IpcMessageChannel.ts";
import { IpcMessageChannel } from "./IpcMessageChannel.ts";
import { RpcEndpoint } from "./RpcEndpoint.ts";

export const ExtensionHostDIToken = token<ExtensionHost>("ExtensionHost");

export interface IExtensionHostOptions {
    /**
     * Команда и аргументы для запуска subprocess'а. По умолчанию вычисляется
     * автоматически (`process.execPath` + `process.execArgv` + main script).
     * Перекрывается в тестах.
     */
    readonly spawnArgs?: () => { command: string; args: string[]; env?: NodeJS.ProcessEnv };
    /**
     * Тайм-аут на ожидание `host.ready` от subprocess'а, мс. Default: 5000.
     */
    readonly readyTimeoutMs?: number;
    /**
     * Тайм-аут на graceful shutdown через `host.shutdown` перед `SIGTERM`. Default: 1500.
     */
    readonly shutdownTimeoutMs?: number;
    /**
     * Логгер для lifecycle-событий host'а (канал `extensions.host`). Подканалы
     * `extensions.host.rpc` / `.stdout` / `.stderr` берутся из {@link logService}, если передан.
     */
    readonly logger?: ILogger;
    /**
     * Логгер для trace каждого RPC-сообщения (канал `extensions.host.rpc`).
     */
    readonly rpcLogger?: ILogger;
    /**
     * Логгер для stdout subprocess'а (канал `extensions.host.stdout`). Если передан —
     * stdio[1] переключается в `"pipe"`; иначе остаётся `"inherit"`.
     */
    readonly stdoutLogger?: ILogger;
    /**
     * Логгер для stderr subprocess'а (канал `extensions.host.stderr`).
     */
    readonly stderrLogger?: ILogger;
}

/**
 * Host-сторона extension subsystem'ы. Форкает один subprocess (через
 * `child_process.spawn(process.execPath, ..., { stdio: [...,'ipc'] })`) и
 * управляет жизненным циклом расширений через RPC поверх Node IPC-канала.
 *
 * Subprocess — это тот же бинарь / тот же main.ts с env-флагом
 * `VEXX_EXTENSION_HOST=1`; ранний branch в `main.ts` уводит управление в
 * `runExtensionHostSubprocess()`.
 *
 * Lifecycle:
 * - `registerExtension(reg)` — лениво поднимает subprocess (если ещё не) и
 *   шлёт `host.activateExtension`. Бросает, если активация не удалась.
 * - `unregisterExtension(id)` — `host.deactivateExtension`.
 * - `dispose()` — `host.shutdown` (best effort) → ждём exit → SIGTERM →
 *   SIGKILL fallback.
 */
export class ExtensionHost extends Disposable {
    private readonly editorOptions: IEditorOptionsService;
    private readonly options: Required<Pick<IExtensionHostOptions, "spawnArgs" | "readyTimeoutMs" | "shutdownTimeoutMs">>;
    private readonly logger: ILogger | undefined;
    private readonly rpcLogger: ILogger | undefined;
    private readonly stdoutLogger: ILogger | undefined;
    private readonly stderrLogger: ILogger | undefined;
    private readonly extensions = new Set<string>();
    private subprocess: ChildProcess | null = null;
    private channel: IpcMessageChannel | null = null;
    private rpc: RpcEndpoint | null = null;
    private readyPromise: Promise<void> | null = null;
    private hostDisposed = false;

    public constructor(editorOptions: IEditorOptionsService, options: IExtensionHostOptions = {}) {
        super();
        this.editorOptions = editorOptions;
        this.options = {
            spawnArgs: options.spawnArgs ?? defaultSpawnArgs,
            readyTimeoutMs: options.readyTimeoutMs ?? 5000,
            shutdownTimeoutMs: options.shutdownTimeoutMs ?? 1500,
        };
        this.logger = options.logger;
        this.rpcLogger = options.rpcLogger;
        this.stdoutLogger = options.stdoutLogger;
        this.stderrLogger = options.stderrLogger;
    }

    public async registerExtension(reg: IExtensionRegistration): Promise<IDisposable> {
        if (this.hostDisposed) throw new Error("ExtensionHost disposed");
        if (this.extensions.has(reg.id)) {
            throw new Error(`Extension "${reg.id}" already registered`);
        }
        this.logger?.debug(`registerExtension(${reg.id})`, { mainPath: reg.mainPath });
        const rpc = await this.ensureSubprocess();
        await rpc.request("host.activateExtension", { id: reg.id, mainPath: reg.mainPath });
        this.extensions.add(reg.id);
        this.logger?.info(`activated extension "${reg.id}"`);
        return {
            dispose: (): void => {
                if (!this.extensions.has(reg.id)) return;
                void this.unregisterExtension(reg.id);
            },
        };
    }

    public async unregisterExtension(id: string): Promise<void> {
        if (!this.extensions.has(id)) return;
        this.extensions.delete(id);
        const rpc = this.rpc;
        if (rpc === null) return;
        try {
            await rpc.request("host.deactivateExtension", { id });
            this.logger?.info(`deactivated extension "${id}"`);
        } catch (err) {
            // subprocess мог уже умереть — игнорируем.
            this.logger?.debug(`deactivateExtension(${id}) ignored`, err);
        }
    }

    public hasExtension(id: string): boolean {
        return this.extensions.has(id);
    }

    public get extensionCount(): number {
        return this.extensions.size;
    }

    public override dispose(): void {
        if (this.hostDisposed) return;
        this.hostDisposed = true;
        this.extensions.clear();
        void this.shutdownSubprocess();
        super.dispose();
    }

    /**
     * Ленивая инициализация subprocess'а. Идемпотентна — параллельные вызовы
     * получают одну и ту же `readyPromise`.
     */
    private async ensureSubprocess(): Promise<RpcEndpoint> {
        if (this.rpc !== null && this.readyPromise !== null) {
            await this.readyPromise;
            return this.rpc;
        }
        const spec = this.options.spawnArgs();
        const stdoutMode: "pipe" | "inherit" = this.stdoutLogger !== undefined ? "pipe" : "inherit";
        const stderrMode: "pipe" | "inherit" = this.stderrLogger !== undefined ? "pipe" : "inherit";
        this.logger?.debug("spawning extension host subprocess", {
            command: spec.command,
            args: spec.args,
            stdio: ["ignore", stdoutMode, stderrMode, "ipc"],
        });
        const child = spawn(spec.command, spec.args, {
            stdio: ["ignore", stdoutMode, stderrMode, "ipc"],
            env: spec.env ?? { ...process.env, VEXX_EXTENSION_HOST: "1" },
        });
        if (child.stdout !== null && this.stdoutLogger !== undefined) {
            pipeStreamToLogger(child.stdout, this.stdoutLogger, "info");
        }
        if (child.stderr !== null && this.stderrLogger !== undefined) {
            pipeStreamToLogger(child.stderr, this.stderrLogger, "warn");
        }
        child.once("exit", (code, signal) => {
            this.logger?.info("extension host subprocess exited", { code, signal });
        });
        child.once("error", (err) => {
            this.logger?.error("extension host subprocess error", err);
        });
        const channel = new IpcMessageChannel(child as unknown as IIpcEndpoint);
        const rpc = new RpcEndpoint(channel, this.rpcLogger);
        this.installHostHandlers(rpc);

        this.subprocess = child;
        this.channel = channel;
        this.rpc = rpc;

        this.readyPromise = waitForReady(rpc, child, this.options.readyTimeoutMs).then(() => {
            this.logger?.info("extension host ready");
            // Send initial active editor state so that window.activeTextEditor
            // is correct before the first host.activateExtension call.
            rpc.notify("editor.activeEditorChanged", { fileName: this.editorOptions.getActiveEditorFilePath() });
        });
        await this.readyPromise;
        return rpc;
    }

    private installHostHandlers(rpc: RpcEndpoint): void {
        rpc.handleRequest("editor.setOptions", (params): unknown => {
            const patch = sanitizeOptionsPatch(params);
            this.editorOptions.setActiveEditorOptions(patch);
            return null;
        });
        rpc.handleRequest("editor.getOptions", (): unknown => {
            return this.editorOptions.getActiveEditorOptions();
        });
        this.register(
            this.editorOptions.onActiveEditorChanged((filePath) => {
                rpc.notify("editor.activeEditorChanged", { fileName: filePath });
            }),
        );
    }

    private async shutdownSubprocess(): Promise<void> {
        const rpc = this.rpc;
        const channel = this.channel;
        const child = this.subprocess;
        this.rpc = null;
        this.channel = null;
        this.subprocess = null;
        this.readyPromise = null;
        if (child === null) {
            rpc?.dispose();
            channel?.dispose();
            return;
        }
        const exit = waitForExit(child);
        if (rpc !== null) {
            try {
                await Promise.race([rpc.request("host.shutdown"), sleep(this.options.shutdownTimeoutMs)]);
            } catch {
                // ignore
            }
        }
        if (child.exitCode === null && !child.killed) {
            try {
                child.kill("SIGTERM");
            } catch {
                // ignore
            }
            await Promise.race([exit, sleep(500)]);
        }
        if (child.exitCode === null && !child.killed) {
            try {
                child.kill("SIGKILL");
            } catch {
                // ignore
            }
            await Promise.race([exit, sleep(500)]);
        }
        rpc?.dispose();
        channel?.dispose();
    }
}

function sanitizeOptionsPatch(raw: unknown): IEditorOptionsPatch {
    if (typeof raw !== "object" || raw === null) return {};
    const obj = raw as { tabSize?: unknown; insertSpaces?: unknown };
    const patch: { tabSize?: number; insertSpaces?: boolean } = {};
    if (typeof obj.tabSize === "number" && Number.isFinite(obj.tabSize) && obj.tabSize > 0) {
        patch.tabSize = Math.floor(obj.tabSize);
    }
    if (typeof obj.insertSpaces === "boolean") {
        patch.insertSpaces = obj.insertSpaces;
    }
    return patch;
}

function defaultSpawnArgs(): { command: string; args: string[] } {
    if (detectIsSea()) {
        // В SEA-режиме сам бинарь = `process.execPath`; main script отсутствует.
        return { command: process.execPath, args: [] };
    }
    const mainScript = process.argv[1];
    if (typeof mainScript !== "string" || mainScript === "") {
        throw new Error("ExtensionHost: cannot determine main script for dev subprocess");
    }
    return { command: process.execPath, args: [...process.execArgv, mainScript] };
}

/**
 * `node:sea` доступен только через `require()` внутри SEA-сборки — статический
 * ESM-импорт падает с `ERR_UNKNOWN_BUILTIN_MODULE` даже в работающем SEA exe.
 * См. `Common/Assets/createDefaultAssetAccess.ts` за тот же паттерн.
 */
function detectIsSea(): boolean {
    try {
        const req = createRequire("file:///");
        const sea = req("node:sea") as { isSea(): boolean };
        return sea.isSea();
    } catch {
        return false;
    }
}

function waitForReady(rpc: RpcEndpoint, child: ChildProcess, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const handle = rpc.handleNotification("host.ready", () => {
            handle.dispose();
            cleanup();
            resolve();
        });
        const onExit = (code: number | null): void => {
            handle.dispose();
            cleanup();
            reject(new Error(`extension host subprocess exited before ready (code ${String(code)})`));
        };
        const timer = setTimeout(() => {
            handle.dispose();
            cleanup();
            reject(new Error(`extension host subprocess did not become ready in ${String(timeoutMs)}ms`));
        }, timeoutMs);
        const cleanup = (): void => {
            child.off("exit", onExit);
            clearTimeout(timer);
        };
        child.once("exit", onExit);
    });
}

function waitForExit(child: ChildProcess): Promise<void> {
    return new Promise((resolve) => {
        if (child.exitCode !== null || child.killed) {
            resolve();
            return;
        }
        child.once("exit", () => {
            resolve();
        });
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Линейно-буферизованная подписка на `Readable` (stdout/stderr subprocess'а).
 * Каждую полную строку (`\n`-delimited) пишем как одну запись лога. Хвост без
 * `\n` сбрасываем при `end`.
 */
function pipeStreamToLogger(stream: NodeJS.ReadableStream, logger: ILogger, level: "info" | "warn"): void {
    stream.setEncoding("utf8");
    let buffer = "";
    stream.on("data", (chunk: string) => {
        buffer += chunk;
        let nl = buffer.indexOf("\n");
        while (nl !== -1) {
            const line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.length > 0) {
                if (level === "warn") logger.warn(line);
                else logger.info(line);
            }
            nl = buffer.indexOf("\n");
        }
    });
    stream.on("end", () => {
        if (buffer.length > 0) {
            if (level === "warn") logger.warn(buffer);
            else logger.info(buffer);
            buffer = "";
        }
    });
}
