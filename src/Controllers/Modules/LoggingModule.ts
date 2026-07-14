import type { ContainerModule } from "../../vs/platform/instantiation/common/instantiation.ts";
import type { ILogService } from "../../vs/platform/log/common/log.ts";
import { ILogServiceDIToken } from "../../vs/platform/log/common/logDIToken.ts";
import { NULL_LOG_SERVICE } from "../../vs/platform/log/common/nullLogService.ts";

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
