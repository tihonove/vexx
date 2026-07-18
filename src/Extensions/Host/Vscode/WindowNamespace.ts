import type * as vscode from "vscode";

import type { RpcEndpoint } from "../RpcEndpoint.ts";
import { type IWireFileDecoration, serializeDecorationRenderOptions } from "../WireTypes.ts";

import type { ExtHostTextDocument } from "./ExtHostDocuments.ts";
import type { IVscodeHostContext } from "./VscodeHostContext.ts";
import { DisposableImpl, Uri } from "./VscodeTypes.ts";

/** Wire-форма диапазона декорации (nested `start`/`end`, совпадает с `IRange`). */
interface IWireRange {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
}

function toWireRange(range: vscode.Range): IWireRange {
    return {
        start: { line: range.start.line, character: range.start.character },
        end: { line: range.end.line, character: range.end.character },
    };
}

/** Диапазоны из `setDecorations` — либо голые Range, либо DecorationOptions с `.range`. */
function normalizeDecorationRanges(
    rangesOrOptions: readonly vscode.Range[] | readonly vscode.DecorationOptions[],
): IWireRange[] {
    return rangesOrOptions.map((item) => {
        const range = "range" in item ? item.range : item;
        return toWireRange(range);
    });
}

/** Никогда-не-отменённый токен для `provideFileDecoration` (host-мост не отменяет запросы). */
const NEVER_CANCELLED = {
    isCancellationRequested: false,
    /* v8 ignore next -- defensive stub: host-мост никогда не отменяет provideFileDecoration, слушатель не вызывается */
    onCancellationRequested: () => new DisposableImpl(() => undefined),
} as unknown as vscode.CancellationToken;

function normalizeChangedUris(changed: undefined | vscode.Uri | vscode.Uri[]): vscode.Uri[] {
    if (changed === undefined) return [];
    return Array.isArray(changed) ? changed : [changed];
}

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

    let activeEditorUri: string | null = null;
    // Ключ — сам ExtHostTextDocument (стабилен по ресурсу), поэтому
    // editor.document === registry.getOrCreate(uri) по построению.
    const editorCache = new WeakMap<ExtHostTextDocument, vscode.TextEditor>();
    const activeEditorListeners: ((editor: vscode.TextEditor | undefined) => void)[] = [];

    // Монотонный ключ типа декорации + маппинг type-объект → числовой ключ.
    // Ключ живёт локально в субпроцессе; хост знает тип только по числу.
    let nextDecorationKey = 1;
    const decorationTypeKeys = new WeakMap<object, number>();

    rpc.handleNotification("editor.activeEditorChanged", (params) => {
        const meta = params as {
            uri: string | null;
            languageId?: string | null;
            isDirty?: boolean;
            encoding?: string | null;
            eol?: number | null;
        };
        activeEditorUri = meta.uri;
        let editor: vscode.TextEditor | undefined;
        if (meta.uri != null) {
            const doc = registry.upsertMeta({
                uri: meta.uri,
                languageId: meta.languageId ?? undefined,
                isDirty: meta.isDirty,
                encoding: meta.encoding ?? undefined,
                eol: meta.eol === 1 || meta.eol === 2 ? meta.eol : undefined,
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
            // Применение набора декораций (`vscode.TextEditor.setDecorations`):
            // резолвим числовой ключ типа и шлём диапазоны хосту. Пустой набор
            // (`[]`) снимает декорации этого типа в этом файле.
            setDecorations: (
                decorationType: vscode.TextEditorDecorationType,
                rangesOrOptions: readonly vscode.Range[] | readonly vscode.DecorationOptions[],
            ): void => {
                const key = decorationTypeKeys.get(decorationType as unknown as object);
                if (key === undefined) return;
                rpc.notify("editor.setDecorations", {
                    key,
                    uri: document.uri.toString(),
                    ranges: normalizeDecorationRanges(rangesOrOptions),
                });
            },
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

    // Опрашивает провайдер по изменившимся uri и шлёт хосту результат. uri без
    // декорации (провайдер вернул null) уходит «голым» — хост трактует это как
    // снятие декорации с файла. `undefined` (все файлы) не разворачивается: у
    // субпроцесса нет списка всех uri, а хост держит полный набор сам.
    async function pushFileDecorations(
        provider: vscode.FileDecorationProvider,
        changed: undefined | vscode.Uri | vscode.Uri[],
    ): Promise<void> {
        const uris = normalizeChangedUris(changed);
        if (uris.length === 0) return;
        const decorations: IWireFileDecoration[] = [];
        for (const uri of uris) {
            const decoration = await provider.provideFileDecoration(uri, NEVER_CANCELLED);
            const entry: IWireFileDecoration = {
                uri: uri.toString(),
                ...(decoration?.badge !== undefined ? { badge: decoration.badge } : {}),
                ...(decoration?.color !== undefined ? { colorId: decoration.color.id } : {}),
                ...(decoration?.propagate !== undefined ? { propagate: decoration.propagate } : {}),
            };
            decorations.push(entry);
        }
        rpc.notify("window.fileDecorationsChanged", { decorations });
    }

    const windowNs = {
        get activeTextEditor(): vscode.TextEditor | undefined {
            if (activeEditorUri === null) return undefined;
            return getEditorFor(registry.getOrCreate(Uri.parse(activeEditorUri)));
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

        // Создаёт тип декорации: числовой ключ монотонен и живёт локально;
        // хосту уходит сериализованный options (ThemeColor → { $themeColor: id }).
        // `dispose()` шлёт хосту снятие типа (все его декорации гаснут).
        createTextEditorDecorationType: (options: vscode.DecorationRenderOptions): vscode.TextEditorDecorationType => {
            const key = nextDecorationKey++;
            const type = {
                key: String(key),
                dispose: (): void => {
                    rpc.notify("window.disposeTextEditorDecorationType", { key });
                },
            };
            decorationTypeKeys.set(type, key);
            rpc.notify("window.createTextEditorDecorationType", {
                key,
                options: serializeDecorationRenderOptions(options),
            });
            return type as unknown as vscode.TextEditorDecorationType;
        },

        // Провайдер файловых декораций живёт в субпроцессе; мост подписывается на
        // его onDidChangeFileDecorations и сам опрашивает provideFileDecoration по
        // изменившимся uri, проталкивая результат хосту.
        registerFileDecorationProvider: (provider: vscode.FileDecorationProvider): vscode.Disposable => {
            const changeEvent = provider.onDidChangeFileDecorations;
            if (changeEvent === undefined) {
                return new DisposableImpl(() => undefined) as unknown as vscode.Disposable;
            }
            return changeEvent((changed) => {
                void pushFileDecorations(provider, changed);
            });
        },

        createOutputChannel: (name: string): vscode.OutputChannel => {
            // stdout субпроцесса пробрасывается в логгер `extensions.host.stdout`.
            const log = (value: string): void => {
                console.log(`[${name}] ${value}`);
            };
            return {
                name,
                append: (value: string) => {
                    log(value);
                },
                appendLine: (value: string) => {
                    log(value);
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
