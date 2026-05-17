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
                    // но в Phase 1 не маршрутизируются обратно — добавим в Phase 8+.
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
