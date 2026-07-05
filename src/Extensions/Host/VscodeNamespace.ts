import type * as vscode from "vscode";

import type { ExtHostTextDocument } from "./Vscode/ExtHostDocuments.ts";
import { DocumentRegistry } from "./Vscode/ExtHostDocuments.ts";
import {
    CompletionItem,
    CompletionItemKind,
    DisposableImpl,
    EndOfLine,
    EventEmitter,
    FileType,
    Position,
    Range,
    TextDocumentSaveReason,
    TextEdit,
    Uri,
} from "./Vscode/VscodeTypes.ts";
import { buildCommandsNamespace } from "./Vscode/CommandsNamespace.ts";
import type { RpcEndpoint } from "./RpcEndpoint.ts";

/**
 * Собирает объект `vscode`, раздаваемый расширениям (in-process в тестах или в
 * subprocess через `Module._cache`).
 *
 * Ассемблер держит общее состояние — {@link DocumentRegistry} со стабильной
 * идентичностью документов и кэш editor-объектов — и композирует поверх него
 * namespace'ы. Пока это только `window`; WP3/WP4 добавят `workspace`/`commands`/
 * `languages` поверх ТОГО ЖЕ реестра (см. маркер ниже). Value-типы
 * (`Position`, `Range`, `TextEdit`, `Uri`, enum'ы, `EventEmitter`) отдаются как
 * runtime-поля — расширение делает `new vscode.Position(...)` и т.п.
 *
 * Все мутирующие действия проксируются хосту как RPC-запросы; прямой ссылки на
 * host-сервисы у `vscode`-неймспейса нет.
 */
export function buildVscodeNamespace(rpc: RpcEndpoint): typeof vscode {
    // --- Общее состояние (seam, который читают будущие WP3/WP4) ---
    const registry = new DocumentRegistry();
    let activeEditorFileName: string | null = null;
    // Ключ — сам ExtHostTextDocument (канонично стабилен по fileName), поэтому
    // editor.document === registry.getOrCreate(fileName) по построению.
    const editorCache = new WeakMap<ExtHostTextDocument, vscode.TextEditor>();
    const activeEditorListeners: ((editor: vscode.TextEditor | undefined) => void)[] = [];

    rpc.handleNotification("editor.activeEditorChanged", (params) => {
        const { fileName } = params as { fileName: string | null };
        activeEditorFileName = fileName;
        const editor = fileName != null ? getEditorFor(registry.upsertMeta({ fileName })) : undefined;
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
            if (activeEditorFileName === null) return undefined;
            return getEditorFor(registry.getOrCreate(activeEditorFileName));
        },

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

    // --- WP4: commands bridge поверх симметричного rpc (собственная локальная
    //     Map команд + прокси в host CommandRegistry). WP3 добавит рядом
    //     workspace/languages поверх ТОГО ЖЕ `registry`. ---
    const commandsNs = buildCommandsNamespace(rpc);

    return {
        version: "vexx-phase-1",
        Disposable: DisposableImpl,
        // Value-типы — обязательно перечислить поимённо: каст `as unknown as
        // typeof vscode` прячет пропуск, он всплыл бы только рантайм-undefined
        // внутри расширения (`new vscode.Position(...)`).
        Position,
        Range,
        TextEdit,
        Uri,
        EventEmitter,
        CompletionItem,
        EndOfLine,
        TextDocumentSaveReason,
        FileType,
        CompletionItemKind,
        window: windowNs,
        commands: commandsNs,
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
