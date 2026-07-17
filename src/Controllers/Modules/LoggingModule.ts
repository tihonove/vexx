import { type ContainerModule, token } from "../../Common/DiContainer.ts";
import type { ILogService } from "../../Common/Logging/ILogService.ts";
import { ILogServiceDIToken } from "../../Common/Logging/ILogServiceDIToken.ts";
import { NULL_LOG_SERVICE } from "../../Common/Logging/NullLogService.ts";
import { RingBufferSink } from "../../Common/Logging/sinks/RingBufferSink.ts";

/** In-memory лог-буфер — источник данных для Output-панели (см. `OutputController`). */
export const RingBufferSinkDIToken = token<RingBufferSink>("RingBufferSink");

export interface LoggingModuleContext {
    logService: ILogService;
    /** Кольцевой буфер, уже подключённый к `logService` в `main.ts` — отдаём Output UI. */
    ringBuffer: RingBufferSink;
}

/**
 * Биндит `ILogServiceDIToken` на готовый экземпляр `ILogService` и
 * `RingBufferSinkDIToken` на его in-memory буфер.
 * В production-сборке это `LogService` с подключёнными sinks (см. `main.ts`),
 * в тестах — `NULL_LOG_SERVICE` (см. `loggingModuleDefault`).
 */
export const loggingModule: ContainerModule<LoggingModuleContext> = (container, { logService, ringBuffer }) => {
    container.bind(ILogServiceDIToken, () => logService);
    container.bind(RingBufferSinkDIToken, () => ringBuffer);
};

/** Shortcut с null-сервисом и пустым буфером для тестов и demo. */
export const loggingModuleDefault: ContainerModule = (container) => {
    const ringBuffer = new RingBufferSink();
    container.bind(ILogServiceDIToken, () => NULL_LOG_SERVICE);
    container.bind(RingBufferSinkDIToken, () => ringBuffer);
};
