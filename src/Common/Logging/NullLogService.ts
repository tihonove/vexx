import type { IDisposable } from "../Disposable.ts";

import type { ILogger } from "./ILogger.ts";
import type { ILogService, ILogSink, LogEntry } from "./ILogService.ts";
import { LogLevel } from "./LogLevel.ts";

const NOOP_DISPOSABLE: IDisposable = {
    dispose: () => {
        /* no-op */
    },
};

const NULL_LOGGER: ILogger = {
    trace: () => {
        /* no-op */
    },
    debug: () => {
        /* no-op */
    },
    info: () => {
        /* no-op */
    },
    warn: () => {
        /* no-op */
    },
    error: () => {
        /* no-op */
    },
    isEnabled: () => false,
};

/**
 * No-op реализация `ILogService` для тестов и demo. Никаких sinks, никаких
 * аллокаций при логировании, `isEnabled` всегда возвращает false.
 */
export const NULL_LOG_SERVICE: ILogService = {
    createLogger(_channel: string): ILogger {
        return NULL_LOGGER;
    },
    setLevel(_channelOrWildcard: string, _level: LogLevel): void {
        /* no-op */
    },
    getLevel(_channel: string): LogLevel {
        return LogLevel.Off;
    },
    addSink(_sink: ILogSink): IDisposable {
        return NOOP_DISPOSABLE;
    },
    onDidAppend(_listener: (entry: LogEntry) => void): IDisposable {
        return NOOP_DISPOSABLE;
    },
};
