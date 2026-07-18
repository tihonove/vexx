import type { ContainerModule } from "../../Common/DiContainer.ts";
import { TrashService, TrashServiceDIToken } from "../Workspace/TrashService.ts";
import { UndoRedoService, UndoRedoServiceDIToken } from "../../Workbench/Services/Workspace/UndoRedoService.ts";
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
