import type { ContainerModule } from "../../Common/DiContainer.ts";
import type { IStateService } from "../../Configuration/IStateService.ts";
import { NULL_STATE_SERVICE } from "../../Configuration/NullStateService.ts";
import { StateServiceDIToken } from "../Services/CoreTokens.ts";

export interface StateModuleContext {
    stateService: IStateService;
}

/**
 * Биндит `StateServiceDIToken` на готовый экземпляр. В production это
 * `loadState(paths, logger)` (см. `main.ts`), в тестах/demo —
 * `NULL_STATE_SERVICE` (см. `stateModuleDefault`). Зеркало `configurationModule`.
 */
export const stateModule: ContainerModule<StateModuleContext> = (container, { stateService }) => {
    container.bind(StateServiceDIToken, () => stateService);
};

/** Shortcut с null-сервисом для тестов и demo. */
export const stateModuleDefault: ContainerModule = (container) => {
    container.bind(StateServiceDIToken, () => NULL_STATE_SERVICE);
};
