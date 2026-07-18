import type { ContainerModule } from "../../Common/DiContainer.ts";
import type { ILogService } from "../../Common/Logging/ILogService.ts";
import { ILogServiceDIToken } from "../../Common/Logging/ILogServiceDIToken.ts";
import { NULL_LOG_SERVICE } from "../../Common/Logging/NullLogService.ts";

export interface LoggingModuleContext {
    logService: ILogService;
}

/**
 * Биндит `ILogServiceDIToken` на готовый экземпляр `ILogService`.
 * В production-сборке это `LogService` с подключёнными sinks (см. `main.ts`),
 * в тестах — `NULL_LOG_SERVICE` (см. `loggingModuleDefault`).
 */
export const loggingModule: ContainerModule<LoggingModuleContext> = (container, { logService }) => {
    container.bind(ILogServiceDIToken, () => logService);
};

/** Shortcut с null-сервисом для тестов и demo. */
export const loggingModuleDefault: ContainerModule = (container) => {
    container.bind(ILogServiceDIToken, () => NULL_LOG_SERVICE);
};
