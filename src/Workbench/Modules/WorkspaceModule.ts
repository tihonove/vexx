import type { ContainerModule } from "../../Common/DiContainer.ts";
import { TrashService, TrashServiceDIToken } from "../Services/Workspace/TrashService.ts";
import { UndoRedoService, UndoRedoServiceDIToken } from "../Services/Workspace/UndoRedoService.ts";
import { WorkspaceEditService, WorkspaceEditServiceDIToken } from "../Services/Workspace/WorkspaceEditService.ts";

/**
 * Сервисы единой системы отмены уровня workspace: история (`UndoRedoService`),
 * системная корзина (`TrashService`) и исполнитель файловых правок
 * (`WorkspaceEditService`). `WorkspaceEditService` зависит от `IConfigurationService`
 * (см. `configurationModule`).
 */
export const workspaceModule: ContainerModule = (container) => {
    container.bind(UndoRedoServiceDIToken, () => new UndoRedoService());
    container.bind(TrashServiceDIToken, () => new TrashService());
    container.bind(WorkspaceEditServiceDIToken, WorkspaceEditService);
};
