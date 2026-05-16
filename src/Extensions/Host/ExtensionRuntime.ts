import type * as vscode from "vscode";

import type { IDisposable } from "../../Common/Disposable.ts";

import type { IExtensionEntry } from "./IExtensionEntry.ts";
import type { IMessageChannel } from "./IMessageChannel.ts";
import { RpcEndpoint } from "./RpcEndpoint.ts";

/**
 * Side-of-extension runtime: исполняется «в адресном пространстве» расширения
 * (in-process в Phase 1, в дочернем процессе позже). Принимает канал к хосту,
 * строит минимальный объект `vscode` и вызывает `entry.activate(context, api)`.
 *
 * Все обращения расширения к `vscode.*` идут через {@link RpcEndpoint}.request
 * — никакой прямой ссылки на host-сервисы у runtime нет.
 */
export class ExtensionRuntime implements IDisposable {
    private readonly rpc: RpcEndpoint;
    private readonly entry: IExtensionEntry;
    private readonly context: vscode.ExtensionContext;
    private readonly api: typeof vscode;
    private disposed = false;

    public constructor(channel: IMessageChannel, entry: IExtensionEntry) {
        this.rpc = new RpcEndpoint(channel);
        this.entry = entry;
        this.context = { subscriptions: [] };
        this.api = buildVscodeNamespace(this.rpc);
    }

    public async activate(): Promise<void> {
        await this.entry.activate(this.context, this.api);
    }

    public async deactivate(): Promise<void> {
        if (this.disposed) return;
        try {
            await this.entry.deactivate?.();
        } finally {
            for (const sub of this.context.subscriptions.splice(0).reverse()) {
                try {
                    sub.dispose();
                } catch {
                    // Phase 1: глотаем
                }
            }
        }
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.rpc.dispose();
    }
}

/**
 * Строит минимальную реализацию `vscode` для Phase 1: только
 * `window.activeTextEditor.options` + `Disposable`. Все мутации `options`
 * отправляются хосту как RPC-запросы.
 */
function buildVscodeNamespace(rpc: RpcEndpoint): typeof vscode {
    class DisposableImpl {
        private readonly callOnDispose: () => unknown;
        public constructor(callOnDispose: () => unknown) {
            this.callOnDispose = callOnDispose;
        }
        public dispose(): unknown {
            return this.callOnDispose();
        }
        public static from(...items: { dispose: () => unknown }[]): DisposableImpl {
            return new DisposableImpl(() => {
                for (const item of items) item.dispose();
            });
        }
    }

    const editor = { options: {} as vscode.TextEditorOptions };

    const editorProxy = new Proxy(editor, {
        set: (target, prop, value): boolean => {
            if (prop === "options") {
                if (typeof value !== "object" || value === null) return false;
                const patch = value as vscode.TextEditorOptions;
                const normalized: { tabSize?: number; insertSpaces?: boolean } = {};
                if (patch.tabSize !== undefined) {
                    normalized.tabSize = normalizeTabSize(patch.tabSize);
                }
                if (patch.insertSpaces !== undefined) {
                    normalized.insertSpaces = normalizeInsertSpaces(patch.insertSpaces);
                }
                target.options = { ...target.options, ...patch };
                if (Object.keys(normalized).length > 0) {
                    // Fire-and-forget; ошибки логически принадлежат расширению,
                    // но в Phase 1 не маршрутизируются обратно — добавим в Phase 8.
                    void rpc.request("editor.setOptions", normalized);
                }
                return true;
            }
            return false;
        },
    });

    const windowNs = {
        get activeTextEditor(): vscode.TextEditor {
            return editorProxy as unknown as vscode.TextEditor;
        },
    };

    return {
        version: "vexx-phase-1",
        Disposable: DisposableImpl,
        window: windowNs,
    } as unknown as typeof vscode;
}

function normalizeTabSize(value: number | string): number {
    if (typeof value === "number") return Math.max(1, Math.floor(value));
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 4 : Math.max(1, parsed);
}

function normalizeInsertSpaces(value: boolean | string): boolean {
    if (typeof value === "boolean") return value;
    if (value === "auto") return true;
    return value === "true";
}
