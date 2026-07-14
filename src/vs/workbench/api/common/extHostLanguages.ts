import type * as vscode from "vscode";

import type { WireCompletionItem } from "./extHost.protocol.ts";

import { matchDocumentSelector } from "./documentSelector.ts";
import type { ExtHostTextDocument } from "./extHostDocuments.ts";
import type { IVscodeHostContext } from "./extHostContext.ts";
import { DisposableImpl, EventEmitter, Position, Range } from "./extHostTypes.ts";

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
    };

    return {
        languages: languagesNs as unknown as typeof vscode.languages,
        registrations,
    };
}
