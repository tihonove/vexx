import type { RpcEndpoint } from "../RpcEndpoint.ts";

import type { DocumentRegistry } from "./ExtHostDocuments.ts";
import type { WorkspaceConfigStore } from "./WorkspaceConfigStore.ts";

/**
 * Общее состояние, разделяемое namespace'ами subprocess-шима. Собирается
 * ассемблером {@link ../VscodeNamespace.ts} и передаётся в фабрики
 * `createWindowNamespace` / `createWorkspaceNamespace` / `createLanguagesNamespace`,
 * чтобы все они работали поверх ОДНОГО реестра документов и хранилища конфигурации.
 */
export interface IVscodeHostContext {
    readonly rpc: RpcEndpoint;
    readonly registry: DocumentRegistry;
    readonly configStore: WorkspaceConfigStore;
}
