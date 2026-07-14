import type { ContainerModule } from "../../vs/platform/instantiation/common/instantiation.ts";
import { TrashService, TrashServiceDIToken } from "../../vs/platform/files/node/trashService.ts";
import { UndoRedoService, UndoRedoServiceDIToken } from "../../vs/platform/undoRedo/common/undoRedoService.ts";
import { WorkspaceEditService, WorkspaceEditServiceDIToken } from "../Workspace/WorkspaceEditService.ts";

/**
 * Сервисы единой системы отмены уровня workspace: история (`UndoRedoService`),
 * системная корзина (`TrashService`) и исполнитель файловых правок
 * (`WorkspaceEditService`). Подключается до `controllersModule` — `AppController`
 * достаёт их из контейнера. `WorkspaceEditService` зависит от `IConfigurationService`
 * (см. `configurationModule`).
 */
export const workspaceModule: ContainerModule = (container) => {
    container.bind(UndoRedoServiceDIToken, () => new UndoRedoService());
    container.bind(TrashServiceDIToken, () => new TrashService());
    container.bind(WorkspaceEditServiceDIToken, WorkspaceEditService);
};
