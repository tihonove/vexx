import type { ContainerModule } from "../../Common/DiContainer.ts";
import { AppController, AppControllerDIToken } from "../AppController.ts";
import { DiagnosticsController, DiagnosticsControllerDIToken } from "../DiagnosticsController.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { FileTreeControllerDIToken } from "../FileTreeController.ts";
import { InputWidgetController, InputWidgetControllerDIToken } from "../InputWidgetController.ts";
import { PanelController, PanelControllerDIToken } from "../PanelController.ts";
import { ProblemsController, ProblemsControllerDIToken } from "../ProblemsController.ts";
import { StatusBarController, StatusBarControllerDIToken } from "../StatusBarController.ts";
import { EmbeddedTerminalSession } from "../Terminal/EmbeddedTerminalSession.ts";
import { TerminalSessionFactoryDIToken } from "../Terminal/TerminalSessionFactory.ts";
import { TasksController, TasksControllerDIToken } from "../TasksController.ts";
import { TerminalController, TerminalControllerDIToken } from "../TerminalController.ts";

/**
 * Контроллеры верхнего уровня. Зависят от `commandsModule`,
 * `tokenizationModule`, `themeModule`, `coreModule`/`coreModuleLate`,
 * `backendModule`. Регистрируются как классы — `Container` сам разрешает
 * зависимости через `static dependencies`.
 */
export const controllersModule: ContainerModule = (container) => {
    container.bind(EditorGroupControllerDIToken, EditorGroupController);
    container.bind(StatusBarControllerDIToken, StatusBarController);
    container.bind(DiagnosticsControllerDIToken, DiagnosticsController);
    container.bind(PanelControllerDIToken, PanelController);
    container.bind(ProblemsControllerDIToken, ProblemsController);
    // Прод-фабрика сессий: реальная связка node-pty + @xterm/headless. Тестовый
    // профиль перебивает биндинг на FakeTerminalSurface (см. TestProfile).
    container.bind(TerminalSessionFactoryDIToken, () => (options) => new EmbeddedTerminalSession(options));
    container.bind(TerminalControllerDIToken, TerminalController);
    // Таски переиспользуют ту же фабрику сессий (тест-профиль подменяет её на фейк).
    container.bind(TasksControllerDIToken, TasksController);
    container.bind(InputWidgetControllerDIToken, InputWidgetController);
    container.bind(AppControllerDIToken, AppController);
    // Минимальный шов: FileTreeController создаётся внутри AppController — отдаём
    // его по токену (нужен мосту файловых декораций extension-host'а).
    container.bind(FileTreeControllerDIToken, () => container.get(AppControllerDIToken).fileTree);
};
