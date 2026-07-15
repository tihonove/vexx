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

export type TerminalSessionFactory = (options: ITerminalSessionOptions) => ITerminalSurface & IDisposable;

export const TerminalSessionFactoryDIToken = token<TerminalSessionFactory>("TerminalSessionFactory");
