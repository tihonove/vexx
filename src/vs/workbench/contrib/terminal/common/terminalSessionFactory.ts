// Фабрика сессий встроенного терминала — это шов для тестов: юнит-тесты подменяют
// фабрику на FakeTerminalSurface и не спавнят реальные PTY. Прод-биндинг (реальный
// EmbeddedTerminalSession) навешивается на уровне DI-модулей отдельно.

import { token } from "../../../../platform/instantiation/common/diContainer.ts";
import type { IDisposable } from "../../../../base/common/disposable.ts";
import type { ITerminalSurface } from "../../../../base/common/iTerminalSurface.ts";

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
