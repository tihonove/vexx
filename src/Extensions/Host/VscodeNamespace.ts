import type * as vscode from "vscode";

import type { RpcEndpoint } from "./RpcEndpoint.ts";

/**
 * Строит минимальный объект `vscode`, который раздаётся расширениям
 * (in-process в тестах или внутри subprocess через `Module._cache`).
 *
 * Все мутирующие действия проксируются хосту как RPC-запросы; никакой
 * прямой ссылки на host-сервисы у `vscode`-неймспейса нет.
 */
export function buildVscodeNamespace(rpc: RpcEndpoint): typeof vscode {
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

    // --- Active editor state (updated via editor.activeEditorChanged notifications) ---
    let activeEditorState: { fileName: string } | null = null;
    const activeEditorListeners: ((editor: vscode.TextEditor | undefined) => void)[] = [];

    rpc.handleNotification("editor.activeEditorChanged", (params) => {
        const { fileName } = params as { fileName: string | null };
        activeEditorState = fileName != null ? { fileName } : null;
        const editor = activeEditorState != null ? makeEditorProxy(activeEditorState.fileName) : undefined;
        for (const listener of activeEditorListeners) {
            listener(editor);
        }
    });

    function makeEditorProxy(fileName: string): vscode.TextEditor {
        const editorData = {
            options: {} as vscode.TextEditorOptions,
            document: { fileName },
        };
        return new Proxy(editorData, {
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
                        void rpc.request("editor.setOptions", normalized);
                    }
                    return true;
                }
                return false;
            },
        }) as unknown as vscode.TextEditor;
    }

    const windowNs = {
        get activeTextEditor(): vscode.TextEditor | undefined {
            if (activeEditorState === null) return undefined;
            return makeEditorProxy(activeEditorState.fileName);
        },

        onDidChangeActiveTextEditor: (
            listener: (e: vscode.TextEditor | undefined) => unknown,
            thisArgs?: unknown,
            disposables?: vscode.Disposable[],
        ): vscode.Disposable => {
            const bound =
                thisArgs != null ? (listener as Function).bind(thisArgs) : listener;
            activeEditorListeners.push(bound as typeof listener);
            const disposable = new DisposableImpl(() => {
                const idx = activeEditorListeners.indexOf(bound as typeof listener);
                if (idx >= 0) activeEditorListeners.splice(idx, 1);
            });
            if (disposables !== undefined) disposables.push(disposable as unknown as vscode.Disposable);
            return disposable as unknown as vscode.Disposable;
        },

        createOutputChannel: (name: string): vscode.OutputChannel => {
            return {
                name,
                append: () => {},
                appendLine: () => {},
                replace: () => {},
                clear: () => {},
                show: () => {},
                hide: () => {},
                dispose: () => {},
            } as unknown as vscode.OutputChannel;
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
