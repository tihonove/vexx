import type * as vscode from "vscode";

import { DocumentRegistry } from "./Vscode/ExtHostDocuments.ts";
import { createLanguagesNamespace } from "./Vscode/LanguagesNamespace.ts";
import type { IVscodeHostContext } from "./Vscode/VscodeHostContext.ts";
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
import { createWindowNamespace } from "./Vscode/WindowNamespace.ts";
import { WorkspaceConfigStore } from "./Vscode/WorkspaceConfigStore.ts";
import { createWorkspaceNamespace } from "./Vscode/WorkspaceNamespace.ts";
import type { RpcEndpoint } from "./RpcEndpoint.ts";

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
 * namespace'ы `window` / `workspace` / `languages`. Value-типы (`Position`,
 * `Range`, `TextEdit`, `Uri`, enum'ы, `EventEmitter`) отдаются как runtime-поля —
 * расширение делает `new vscode.Position(...)` и т.п.
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

    const namespace = {
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
        window,
        workspace,
        languages,
    } as unknown as typeof vscode;

    return { namespace, configStore: ctx.configStore };
}
