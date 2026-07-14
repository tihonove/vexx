import type { ContainerModule } from "../../platform/instantiation/common/instantiation.ts";
import { AppController, AppControllerDIToken } from "../../workbench/tui/workbench.ts";
import { DiagnosticsController, DiagnosticsControllerDIToken } from "../../workbench/contrib/markers/tui/diagnosticsController.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "../../workbench/tui/parts/editor/editorGroupController.ts";
import { FileTreeControllerDIToken } from "../../workbench/contrib/files/tui/fileTreeController.ts";
import { InputWidgetController, InputWidgetControllerDIToken } from "../../workbench/contrib/files/tui/inputWidgetController.ts";
import { PanelController, PanelControllerDIToken } from "../../workbench/tui/parts/panel/panelController.ts";
import { ProblemsController, ProblemsControllerDIToken } from "../../workbench/contrib/markers/tui/problemsController.ts";
import { StatusBarController, StatusBarControllerDIToken } from "../../workbench/tui/parts/statusbar/statusBarController.ts";

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
    container.bind(InputWidgetControllerDIToken, InputWidgetController);
    container.bind(AppControllerDIToken, AppController);
    // Минимальный шов: FileTreeController создаётся внутри AppController — отдаём
    // его по токену (нужен мосту файловых декораций extension-host'а).
    container.bind(FileTreeControllerDIToken, () => container.get(AppControllerDIToken).fileTree);
};
