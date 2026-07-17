// Фабрика сессий встроенного терминала — это шов для тестов: юнит-тесты подменяют
// фабрику на FakeTerminalSurface и не спавнят реальные PTY. Прод-биндинг (реальный
// EmbeddedTerminalSession) навешивается на уровне DI-модулей отдельно.

import { token } from "../../Common/DiContainer.ts";
import type { IDisposable } from "../../Common/Disposable.ts";
import type { ITerminalSurface } from "../../TUIDom/Widgets/Terminal/ITerminalSurface.ts";

export interface ITerminalSessionOptions {
    cols: number;
    rows: number;
    shell?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
}

/**
 * Сессия встроенного терминала — {@link ITerminalSurface} (виджет-контракт) плюс
 * Controllers-уровневый «сырой» tap `onData`: тот же поток `pty.onData` ДО VT-эмулятора,
 * которым кормятся проблем-матчеры тасков. Держим его здесь, а не на `ITerminalSurface`,
 * чтобы под `src/TUIDom/` не протекала байтовая/PTY-семантика.
 */
export interface ITerminalSession extends ITerminalSurface, IDisposable {
    onData(cb: (data: string) => void): IDisposable;
}

export type TerminalSessionFactory = (options: ITerminalSessionOptions) => ITerminalSession;

export const TerminalSessionFactoryDIToken = token<TerminalSessionFactory>("TerminalSessionFactory");
