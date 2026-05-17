import type { IDisposable } from "../Disposable.ts";

import type { ILogger } from "./ILogger.ts";
import type { ILogService, ILogSink, LogEntry } from "./ILogService.ts";
import { LogLevel } from "./LogLevel.ts";

const WILDCARD = "*";
const DEFAULT_LEVEL: LogLevel = LogLevel.Trace;

/**
 * Реализация `ILogService`. Хранит:
 * - per-channel уровни (Map): резолвятся каскадом по точечным сегментам
 *   (`a.b.c` → `a.b` → `a` → `*`).
 * - sinks: `append(entry)` фан-аутится во все.
 * - listeners `onDidAppend`: вызываются после sinks.
 *
 * Логгеры — тонкие обёртки: проверяют `isEnabled(level)` через `getLevel(channel)`
 * и эмитят `LogEntry`. Уровень канала кешируется на стороне логгера до первого
 * `setLevel` (после чего bumпается версия и логгер пере-резолвит).
 */
export class LogService implements ILogService {
    private readonly sinks: ILogSink[] = [];
    private readonly levels = new Map<string, LogLevel>();
    private readonly listeners = new Set<(entry: LogEntry) => void>();
    private version = 0;

    public createLogger(channel: string): ILogger {
        return new ChannelLogger(this, channel);
    }

    public setLevel(channelOrWildcard: string, level: LogLevel): void {
        this.levels.set(channelOrWildcard, level);
        this.version++;
    }

    public getLevel(channel: string): LogLevel {
        // Резолвим каскадом: точное совпадение → родительские сегменты → wildcard → default.
        if (this.levels.has(channel)) return this.levels.get(channel) as LogLevel;
        let dot = channel.lastIndexOf(".");
        while (dot > 0) {
            const parent = channel.slice(0, dot);
            if (this.levels.has(parent)) return this.levels.get(parent) as LogLevel;
            dot = channel.lastIndexOf(".", dot - 1);
        }
        if (this.levels.has(WILDCARD)) return this.levels.get(WILDCARD) as LogLevel;
        return DEFAULT_LEVEL;
    }

    public addSink(sink: ILogSink): IDisposable {
        this.sinks.push(sink);
        return {
            dispose: (): void => {
                const i = this.sinks.indexOf(sink);
                if (i >= 0) this.sinks.splice(i, 1);
            },
        };
    }

    public onDidAppend(listener: (entry: LogEntry) => void): IDisposable {
        this.listeners.add(listener);
        return {
            dispose: (): void => {
                this.listeners.delete(listener);
            },
        };
    }

    /**
     * Вызывается логгером после фильтрации по уровню. Фан-аут на sinks
     * защищён try/catch — падение одного sink не должно ломать остальные.
     */
    public append(entry: LogEntry): void {
        for (const sink of this.sinks) {
            try {
                sink.append(entry);
            } catch {
                // sinks не должны валить процесс
            }
        }
        for (const listener of this.listeners) {
            try {
                listener(entry);
            } catch {
                // изоляция листенеров
            }
        }
    }

    public get configVersion(): number {
        return this.version;
    }
}

class ChannelLogger implements ILogger {
    private cachedLevel: LogLevel = LogLevel.Off;
    private cachedVersion = -1;

    public constructor(
        private readonly service: LogService,
        private readonly channel: string,
    ) {}

    public isEnabled(level: LogLevel): boolean {
        if (level === LogLevel.Off) return false;
        const configured = this.resolveLevel();
        if (configured === LogLevel.Off) return false;
        return level >= configured;
    }

    public trace(message: string, ...args: unknown[]): void {
        this.emit(LogLevel.Trace, message, args);
    }

    public debug(message: string, ...args: unknown[]): void {
        this.emit(LogLevel.Debug, message, args);
    }

    public info(message: string, ...args: unknown[]): void {
        this.emit(LogLevel.Info, message, args);
    }

    public warn(message: string, ...args: unknown[]): void {
        this.emit(LogLevel.Warn, message, args);
    }

    public error(message: string, ...args: unknown[]): void {
        this.emit(LogLevel.Error, message, args);
    }

    private emit(level: LogLevel, message: string, args: unknown[]): void {
        if (!this.isEnabled(level)) return;
        this.service.append({
            timestamp: Date.now(),
            channel: this.channel,
            level,
            message,
            args,
        });
    }

    private resolveLevel(): LogLevel {
        const v = this.service.configVersion;
        if (v !== this.cachedVersion) {
            this.cachedLevel = this.service.getLevel(this.channel);
            this.cachedVersion = v;
        }
        return this.cachedLevel;
    }
}
