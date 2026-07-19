import type { LogLevel } from "./logLevel.ts";

/**
 * Тонкая обёртка над `ILogService`, привязанная к конкретному каналу.
 * Каналы — строки с точечной иерархией (`"extensions.host.stdout"`),
 * уровень резолвится каскадом по сегментам.
 */
export interface ILogger {
    trace(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    isEnabled(level: LogLevel): boolean;
}
