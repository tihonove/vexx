import type * as vscode from "vscode";

import type { RpcEndpoint } from "./RpcEndpoint.ts";
import { buildCommandsNamespace } from "./Vscode/CommandsNamespace.ts";
import { DocumentRegistry } from "./Vscode/ExtHostDocuments.ts";
import { createLanguagesNamespace } from "./Vscode/LanguagesNamespace.ts";
import type { IVscodeHostContext } from "./Vscode/VscodeHostContext.ts";
import {
    CallHierarchyItem,
    CancellationError,
    CancellationTokenSource,
    CodeAction,
    CodeActionKind,
    CodeLens,
    CompletionItem,
    CompletionItemKind,
    CompletionItemTag,
    Diagnostic,
    DiagnosticSeverity,
    DiagnosticTag,
    DisposableImpl,
    DocumentHighlightKind,
    DocumentLink,
    EndOfLine,
    EventEmitter,
    FileSystemError,
    FileType,
    FoldingRangeKind,
    Hover,
    InlayHint,
    Location,
    LogLevel,
    MarkdownString,
    ProgressLocation,
    Position,
    Range,
    SymbolInformation,
    SymbolKind,
    SymbolTag,
    TextDocumentSaveReason,
    TextEdit,
    TypeHierarchyItem,
    Uri,
    WorkspaceEdit,
} from "./Vscode/VscodeTypes.ts";
import { createWindowNamespace } from "./Vscode/WindowNamespace.ts";
import { WorkspaceConfigStore } from "./Vscode/WorkspaceConfigStore.ts";
import { createWorkspaceNamespace } from "./Vscode/WorkspaceNamespace.ts";

/**
 * Результат сборки шима: сам объект `vscode` (раздаётся расширениям через
 * `Module._cache`) и {@link WorkspaceConfigStore}, в который subprocess-entry
 * кладёт `configDefaults` расширения ДО `activate()`.
 */
export interface IVscodeHost {
    readonly namespace: typeof vscode;
    readonly configStore: WorkspaceConfigStore;
}

/**
 * Собирает объект `vscode`, раздаваемый расширениям (in-process в тестах или в
 * subprocess через `Module._cache`).
 *
 * Ассемблер держит общее состояние ({@link IVscodeHostContext}: реестр документов
 * со стабильной идентичностью и хранилище конфигурации) и композирует поверх него
 * namespace'ы `window` / `workspace` / `languages` / `commands`. Value-типы
 * (`Position`, `Range`, `TextEdit`, `Uri`, enum'ы, `EventEmitter`) отдаются как
 * runtime-поля — расширение делает `new vscode.Position(...)` и т.п.
 *
 * Все мутирующие действия проксируются хосту как RPC-запросы; прямой ссылки на
 * host-сервисы у `vscode`-неймспейса нет.
 */
export function buildVscodeNamespace(rpc: RpcEndpoint): IVscodeHost {
    const ctx: IVscodeHostContext = {
        rpc,
        registry: new DocumentRegistry(),
        configStore: new WorkspaceConfigStore(),
    };

    const window = createWindowNamespace(ctx);
    const workspace = createWorkspaceNamespace(ctx);
    const { languages } = createLanguagesNamespace(ctx);
    // WP4: commands bridge поверх симметричного rpc (локальная Map команд +
    // прокси в host CommandRegistry).
    const commands = buildCommandsNamespace(rpc);

    // SPIKE (LSP): наивный `env` — vscode-languageclient читает language/appName.
    const env = {
        appName: "Vexx",
        appHost: "desktop",
        language: "en",
        uriScheme: "vexx",
        clipboard: {
            readText: (): Thenable<string> => Promise.resolve(""),
            writeText: (): Thenable<void> => Promise.resolve(),
        },
        openExternal: (): Thenable<boolean> => Promise.resolve(false),
    } as unknown;

    const namespace = {
        // SPIKE (LSP): vscode-languageclient требует валидный VS Code semver
        // (>= ^1.91.0). Держим в лок-степе с builtin/VSCODE_VERSION.
        version: "1.127.0",
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
        FileSystemError,
        CompletionItemKind,
        // SPIKE (LSP): value-типы, требуемые vscode-languageclient.
        Location,
        Diagnostic,
        DiagnosticSeverity,
        DiagnosticTag,
        CodeLens,
        CodeAction,
        CodeActionKind,
        DocumentLink,
        DocumentHighlightKind,
        FoldingRangeKind,
        InlayHint,
        SymbolInformation,
        SymbolKind,
        SymbolTag,
        CompletionItemTag,
        CallHierarchyItem,
        TypeHierarchyItem,
        CancellationError,
        CancellationTokenSource,
        LogLevel,
        ProgressLocation,
        MarkdownString,
        Hover,
        WorkspaceEdit,
        window,
        workspace,
        languages,
        commands,
        env,
    } as unknown as typeof vscode;

    return { namespace, configStore: ctx.configStore };
}
