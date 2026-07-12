import type * as vscode from "vscode";

import type { WireCompletionItem } from "../WireTypes.ts";

import { matchDocumentSelector } from "./DocumentSelector.ts";
import type { ExtHostTextDocument } from "./ExtHostDocuments.ts";
import type { IVscodeHostContext } from "./VscodeHostContext.ts";
import { DisposableImpl, EventEmitter, Position, Range, Uri } from "./VscodeTypes.ts";

/**
 * SPIKE (LSP): wire-форма диагностики (subprocess → host). Range — плоские
 * 0-based поля (как в остальных wire-типах). `severity` — `vscode.DiagnosticSeverity`
 * (0=Error…3=Hint); маппинг в `MarkerSeverity` делает хост.
 */
export interface WireMarker {
    readonly severity: number;
    readonly startLine: number;
    readonly startCharacter: number;
    readonly endLine: number;
    readonly endCharacter: number;
    readonly message: string;
    readonly code?: string;
    readonly source?: string;
}

/** SPIKE (LSP): `vscode.Diagnostic` (наш класс) → {@link WireMarker}. */
function toWireMarker(diag: unknown): WireMarker {
    const d = diag as {
        range?: { start: { line: number; character: number }; end: { line: number; character: number } };
        message?: unknown;
        severity?: unknown;
        code?: unknown;
        source?: unknown;
    };
    const r = d.range ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
    const code = typeof d.code === "string" || typeof d.code === "number" ? String(d.code) : undefined;
    return {
        severity: typeof d.severity === "number" ? d.severity : 0,
        startLine: r.start.line,
        startCharacter: r.start.character,
        endLine: r.end.line,
        endCharacter: r.end.character,
        message: typeof d.message === "string" ? d.message : String(d.message ?? ""),
        ...(code !== undefined ? { code } : {}),
        ...(typeof d.source === "string" ? { source: d.source } : {}),
    };
}

/** Зарегистрированный провайдер автодополнения. */
export interface ICompletionRegistration {
    readonly selector: vscode.DocumentSelector;
    readonly provider: vscode.CompletionItemProvider;
    readonly triggerCharacters: readonly string[];
}

/** Wire-параметры запроса completion (host → subprocess). */
interface IWireCompletionParams {
    readonly fileName: string;
    readonly languageId?: string;
    readonly text?: string;
    readonly line?: number;
    readonly character?: number;
}

/** Токен отмены-заглушка (запросы completion короткоживущие, отмена не нужна). */
function neverCancelledToken(): vscode.CancellationToken {
    return {
        isCancellationRequested: false,
        onCancellationRequested: new EventEmitter<unknown>().event,
    } as unknown as vscode.CancellationToken;
}

/** Читает `label` элемента (строка или `CompletionItemLabel { label }`). */
function readLabel(item: vscode.CompletionItem): string | undefined {
    const label = (item as { label?: unknown }).label;
    if (typeof label === "string") return label;
    if (typeof label === "object" && label !== null && typeof (label as { label?: unknown }).label === "string") {
        return (label as { label: string }).label;
    }
    return undefined;
}

/** Читает `insertText` (строка или `SnippetString { value }`); fallback — label. */
function readInsertText(item: vscode.CompletionItem, label: string): string {
    const insert = (item as { insertText?: unknown }).insertText;
    if (typeof insert === "string") return insert;
    if (typeof insert === "object" && insert !== null && typeof (insert as { value?: unknown }).value === "string") {
        return (insert as { value: string }).value;
    }
    return label;
}

/** Читает `documentation` (строка или `MarkdownString { value }`). */
function readDocumentation(item: vscode.CompletionItem): string | undefined {
    const doc = (item as { documentation?: unknown }).documentation;
    if (typeof doc === "string") return doc;
    if (typeof doc === "object" && doc !== null && typeof (doc as { value?: unknown }).value === "string") {
        return (doc as { value: string }).value;
    }
    return undefined;
}

/** Читает диапазон замены (`Range` или `{ replacing, inserting }`). */
function readRange(item: vscode.CompletionItem): WireCompletionItem["range"] {
    const raw = (item as { range?: unknown }).range;
    if (raw === undefined || raw === null) return undefined;
    const range =
        raw instanceof Range
            ? raw
            : typeof raw === "object" && (raw as { replacing?: unknown }).replacing instanceof Range
              ? (raw as { replacing: Range }).replacing
              : undefined;
    if (range === undefined) return undefined;
    return {
        startLine: range.start.line,
        startCharacter: range.start.character,
        endLine: range.end.line,
        endCharacter: range.end.character,
    };
}

/** Сериализует `vscode.CompletionItem` в wire-форму (subprocess → host). */
function serializeCompletionItem(item: vscode.CompletionItem): WireCompletionItem | null {
    const label = readLabel(item);
    if (label === undefined || label === "") return null;
    const command = (item as { command?: { command?: unknown; arguments?: unknown } }).command;
    const kind = (item as { kind?: unknown }).kind;
    const detail = (item as { detail?: unknown }).detail;
    const sortText = (item as { sortText?: unknown }).sortText;
    const filterText = (item as { filterText?: unknown }).filterText;
    const documentation = readDocumentation(item);
    const range = readRange(item);
    return {
        label,
        insertText: readInsertText(item, label),
        ...(typeof kind === "number" ? { kind } : {}),
        ...(typeof detail === "string" ? { detail } : {}),
        ...(documentation !== undefined ? { documentation } : {}),
        ...(command !== undefined && typeof command.command === "string" && command.command !== ""
            ? {
                  command: {
                      command: command.command,
                      ...(Array.isArray(command.arguments) ? { arguments: command.arguments } : {}),
                  },
              }
            : {}),
        ...(range !== undefined ? { range } : {}),
        ...(typeof sortText === "string" ? { sortText } : {}),
        ...(typeof filterText === "string" ? { filterText } : {}),
    };
}

/** Нормализует результат провайдера в массив `CompletionItem`. */
function normalizeResult(result: unknown): readonly vscode.CompletionItem[] {
    if (result === undefined || result === null) return [];
    if (Array.isArray(result)) return result as vscode.CompletionItem[];
    const items = (result as { items?: unknown }).items;
    return Array.isArray(items) ? (items as vscode.CompletionItem[]) : [];
}

/**
 * `vscode.languages` на стороне subprocess.
 *
 * Хранит регистрации провайдеров автодополнения и обслуживает host-запрос
 * `languages.provideCompletionItems`: обновляет полный снапшот документа в
 * реестре, матчит `DocumentSelector`, вызывает провайдеры и сериализует
 * результат. Наличие провайдеров сигналится хосту через
 * `languages.updateSubscriptions` (0↔1) — без провайдеров хост не гоняет RPC.
 */
export function createLanguagesNamespace(ctx: IVscodeHostContext): {
    languages: typeof vscode.languages;
    registrations: readonly ICompletionRegistration[];
} {
    const { rpc, registry } = ctx;
    const registrations: ICompletionRegistration[] = [];

    function pushSubscriptions(): void {
        rpc.notify("languages.updateSubscriptions", {
            hasCompletionProviders: registrations.length > 0,
        });
    }

    rpc.handleRequest("languages.provideCompletionItems", async (params): Promise<WireCompletionItem[]> => {
        const p = params as IWireCompletionParams;
        const doc: ExtHostTextDocument = registry.upsertFull({
            fileName: p.fileName,
            ...(typeof p.languageId === "string" ? { languageId: p.languageId } : {}),
            text: p.text ?? "",
        });
        const position = new Position(p.line ?? 0, p.character ?? 0);
        const token = neverCancelledToken();
        const context = { triggerKind: 1, triggerCharacter: undefined } as unknown as vscode.CompletionContext;

        const items: WireCompletionItem[] = [];
        for (const reg of registrations) {
            if (!matchDocumentSelector(reg.selector, doc)) continue;
            let result: unknown;
            try {
                result = await Promise.resolve(
                    reg.provider.provideCompletionItems(
                        doc as unknown as vscode.TextDocument,
                        position as unknown as vscode.Position,
                        token,
                        context,
                    ),
                );
            } catch {
                continue; // сбойный провайдер не роняет остальные
            }
            for (const item of normalizeResult(result)) {
                const wire = serializeCompletionItem(item);
                if (wire !== null) items.push(wire);
            }
        }
        return items;
    });

    // SPIKE (LSP): no-op регистрация провайдера — возвращает валидный Disposable.
    const registerProvider = (): vscode.Disposable =>
        new DisposableImpl(() => undefined) as unknown as vscode.Disposable;

    // SPIKE (LSP): коллекция диагностик, форвардящая маркеры хосту через RPC
    // (`diagnostics.publish`) — хост пишет их в Editor/Markers/MarkerService,
    // откуда их подхватывают squiggle-декорации и панель Problems.
    const createDiagnosticCollection = (name?: string): unknown => {
        const owner = "ext:" + (name ?? "diagnostics");
        const store = new Map<string, readonly unknown[]>();

        const fsPathOf = (uri: unknown): string => {
            if (typeof uri === "string") return uri.startsWith("file://") ? Uri.parse(uri).fsPath : uri;
            const u = uri as { fsPath?: string; path?: string; toString(): string };
            return u.fsPath ?? u.path ?? String(u.toString());
        };
        const publish = (uri: unknown, diags: readonly WireMarker[]): void => {
            rpc.notify("diagnostics.publish", { owner, resource: fsPathOf(uri), markers: diags });
        };

        const setOne = (uri: unknown, diags: readonly unknown[] | undefined): void => {
            const wire = (diags ?? []).map(toWireMarker);
            store.set(fsPathOf(uri), wire);
            publish(uri, wire);
        };

        const collection = {
            name: name ?? "diagnostics",
            set: (arg: unknown, diags?: readonly unknown[]): void => {
                // Перегрузка VS Code: set(uri, diags) | set([[uri, diags], …]).
                if (Array.isArray(arg)) {
                    for (const entry of arg as [unknown, readonly unknown[] | undefined][]) {
                        setOne(entry[0], entry[1] ?? []);
                    }
                    return;
                }
                setOne(arg, diags);
            },
            delete: (uri: unknown): void => {
                store.delete(fsPathOf(uri));
                publish(uri, []);
            },
            clear: (): void => {
                for (const key of store.keys()) rpc.notify("diagnostics.publish", { owner, resource: key, markers: [] });
                store.clear();
            },
            forEach: (): void => undefined,
            get: (uri: unknown): readonly unknown[] | undefined => store.get(fsPathOf(uri)),
            has: (uri: unknown): boolean => store.has(fsPathOf(uri)),
            dispose: (): void => {
                collection.clear();
            },
        };
        return collection;
    };

    const languagesNs = {
        registerCompletionItemProvider: (
            selector: vscode.DocumentSelector,
            provider: vscode.CompletionItemProvider,
            ...triggerCharacters: string[]
        ): vscode.Disposable => {
            const registration: ICompletionRegistration = { selector, provider, triggerCharacters };
            registrations.push(registration);
            if (registrations.length === 1) pushSubscriptions();
            return new DisposableImpl(() => {
                const idx = registrations.indexOf(registration);
                if (idx >= 0) {
                    registrations.splice(idx, 1);
                    if (registrations.length === 0) pushSubscriptions();
                }
            }) as unknown as vscode.Disposable;
        },

        // ── SPIKE (LSP): остальные провайдеры регистрируются no-op'ом (клиент
        // заводит их под capabilities сервера); definition в спайке дёргаем
        // сырым запросом мимо провайдера. ─────────────────────────────────────
        createDiagnosticCollection,
        match: (): number => 10,
        registerDefinitionProvider: registerProvider,
        registerDeclarationProvider: registerProvider,
        registerImplementationProvider: registerProvider,
        registerTypeDefinitionProvider: registerProvider,
        registerHoverProvider: registerProvider,
        registerReferenceProvider: registerProvider,
        registerDocumentHighlightProvider: registerProvider,
        registerDocumentSymbolProvider: registerProvider,
        registerWorkspaceSymbolProvider: registerProvider,
        registerCodeActionsProvider: registerProvider,
        registerCodeLensProvider: registerProvider,
        registerDocumentLinkProvider: registerProvider,
        registerColorProvider: registerProvider,
        registerDocumentFormattingEditProvider: registerProvider,
        registerDocumentRangeFormattingEditProvider: registerProvider,
        registerOnTypeFormattingEditProvider: registerProvider,
        registerRenameProvider: registerProvider,
        registerFoldingRangeProvider: registerProvider,
        registerSelectionRangeProvider: registerProvider,
        registerSignatureHelpProvider: registerProvider,
        registerDocumentSemanticTokensProvider: registerProvider,
        registerDocumentRangeSemanticTokensProvider: registerProvider,
        registerInlayHintsProvider: registerProvider,
        registerInlineValuesProvider: registerProvider,
        registerInlineCompletionItemProvider: registerProvider,
        registerLinkedEditingRangeProvider: registerProvider,
        registerCallHierarchyProvider: registerProvider,
        registerTypeHierarchyProvider: registerProvider,
    };

    return {
        languages: languagesNs as unknown as typeof vscode.languages,
        registrations,
    };
}
