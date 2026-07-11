import type * as vscode from "vscode";

import type { RpcEndpoint } from "../RpcEndpoint.ts";

import type { ExtHostTextDocument } from "./ExtHostDocuments.ts";
import type { IVscodeHostContext } from "./VscodeHostContext.ts";
import { DisposableImpl } from "./VscodeTypes.ts";

/**
 * `vscode.window` на стороне subprocess.
 *
 * Держит активный редактор со стабильной идентичностью (кэш editor-объекта по
 * документу — editorconfig сравнивает `activeTextEditor.document === doc` по
 * ссылке), проксирует установку `editor.options` хосту через RPC и стабит
 * оконное состояние / сообщения.
 */
export function createWindowNamespace(ctx: IVscodeHostContext): typeof vscode.window {
    const { rpc, registry } = ctx;

    let activeEditorFileName: string | null = null;
    // Ключ — сам ExtHostTextDocument (стабилен по fileName), поэтому
    // editor.document === registry.getOrCreate(fileName) по построению.
    const editorCache = new WeakMap<ExtHostTextDocument, vscode.TextEditor>();
    const activeEditorListeners: ((editor: vscode.TextEditor | undefined) => void)[] = [];

    rpc.handleNotification("editor.activeEditorChanged", (params) => {
        const meta = params as { fileName: string | null; languageId?: string | null; isDirty?: boolean };
        activeEditorFileName = meta.fileName;
        let editor: vscode.TextEditor | undefined;
        if (meta.fileName != null) {
            const doc = registry.upsertMeta({
                fileName: meta.fileName,
                languageId: meta.languageId ?? undefined,
                isDirty: meta.isDirty,
            });
            editor = getEditorFor(doc);
        }
        for (const listener of [...activeEditorListeners]) {
            listener(editor);
        }
    });

    function getEditorFor(doc: ExtHostTextDocument): vscode.TextEditor {
        const cached = editorCache.get(doc);
        if (cached !== undefined) return cached;
        const editor = makeEditorProxy(doc);
        editorCache.set(doc, editor);
        return editor;
    }

    function makeEditorProxy(document: ExtHostTextDocument): vscode.TextEditor {
        const editorData = {
            options: {} as vscode.TextEditorOptions,
            document,
        };
        return new Proxy(editorData, {
            set: (target, prop, value): boolean => {
                if (prop === "options") {
                    if (typeof value !== "object" || value === null) return false;
                    const patch = value as vscode.TextEditorOptions & { indentSize?: number | string };
                    const normalized: { tabSize?: number; insertSpaces?: boolean; indentSize?: number } = {};
                    if (patch.tabSize !== undefined) {
                        normalized.tabSize = normalizeTabSize(patch.tabSize);
                    }
                    if (patch.insertSpaces !== undefined) {
                        normalized.insertSpaces = normalizeInsertSpaces(patch.insertSpaces);
                    }
                    if (patch.indentSize !== undefined) {
                        const indentSize = normalizeIndentSize(patch.indentSize);
                        if (indentSize !== undefined) normalized.indentSize = indentSize;
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
            if (activeEditorFileName === null) return undefined;
            return getEditorFor(registry.getOrCreate(activeEditorFileName));
        },

        // Оконное состояние. В TUI мы всегда «сфокусированы»; событие
        // регистрируется (editorconfig подписывается), но никогда не стреляет.
        state: { focused: true, active: true } as vscode.WindowState,

        onDidChangeActiveTextEditor: (
            listener: (e: vscode.TextEditor | undefined) => unknown,
            thisArgs?: unknown,
            disposables?: vscode.Disposable[],
        ): vscode.Disposable => {
            const bound: (e: vscode.TextEditor | undefined) => unknown =
                thisArgs != null ? (e) => listener.call(thisArgs, e) : listener;
            activeEditorListeners.push(bound);
            const disposable = new DisposableImpl(() => {
                const idx = activeEditorListeners.indexOf(bound);
                if (idx >= 0) activeEditorListeners.splice(idx, 1);
            });
            if (disposables !== undefined) disposables.push(disposable as unknown as vscode.Disposable);
            return disposable as unknown as vscode.Disposable;
        },

        onDidChangeWindowState: (
            _listener: (e: vscode.WindowState) => unknown,
            _thisArgs?: unknown,
            disposables?: vscode.Disposable[],
        ): vscode.Disposable => {
            // В TUI окно всегда активно — событие никогда не стреляет. Возвращаем
            // валидный no-op Disposable, чтобы регистрация не падала.
            const disposable = new DisposableImpl(() => undefined) as unknown as vscode.Disposable;
            if (disposables !== undefined) disposables.push(disposable);
            return disposable;
        },

        showErrorMessage: (message: string): Thenable<string | undefined> => showMessage(rpc, "error", message),
        showWarningMessage: (message: string): Thenable<string | undefined> => showMessage(rpc, "warn", message),
        showInformationMessage: (message: string): Thenable<string | undefined> => showMessage(rpc, "info", message),

        createOutputChannel: (name: string): vscode.OutputChannel => {
            return {
                name,
                append: () => {
                    /* no-op */
                },
                appendLine: () => {
                    /* no-op */
                },
                replace: () => {
                    /* no-op */
                },
                clear: () => {
                    /* no-op */
                },
                show: () => {
                    /* no-op */
                },
                hide: () => {
                    /* no-op */
                },
                dispose: () => {
                    /* no-op */
                },
            } as unknown as vscode.OutputChannel;
        },
    };

    return windowNs as unknown as typeof vscode.window;
}

function showMessage(
    rpc: RpcEndpoint,
    severity: "error" | "warn" | "info",
    message: string,
): Thenable<string | undefined> {
    rpc.notify("window.showMessage", { severity, message });
    return Promise.resolve(undefined);
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

/** `indentSize` может быть числом либо `"tabSize"` (= совпадает с tabSize → скип). */
function normalizeIndentSize(value: number | string): number | undefined {
    if (typeof value === "number") return Math.max(1, Math.floor(value));
    if (value === "tabSize") return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : Math.max(1, parsed);
}
