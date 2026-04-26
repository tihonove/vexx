import type { ContainerModule } from "../../Common/DiContainer.ts";
import { AppController, AppControllerDIToken } from "../AppController.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { StatusBarController, StatusBarControllerDIToken } from "../StatusBarController.ts";

/**
 * Контроллеры верхнего уровня. Зависят от `commandsModule`,
 * `tokenizationModule`, `themeModule`, `coreModule`/`coreModuleLate`,
 * `backendModule`. Регистрируются как классы — `Container` сам разрешает
 * зависимости через `static dependencies`.
 */
export const controllersModule: ContainerModule = (container) => {
    container.bind(EditorGroupControllerDIToken, EditorGroupController);
    container.bind(StatusBarControllerDIToken, StatusBarController);
    container.bind(AppControllerDIToken, AppController);
};
