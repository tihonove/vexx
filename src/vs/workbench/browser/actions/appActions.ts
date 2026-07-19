import type { ServiceAccessor } from "../../../platform/instantiation/common/diContainer.ts";
import { token } from "../../../platform/instantiation/common/diContainer.ts";
import { MenuId } from "../../../platform/actions/common/menuId.ts";
import { DialogServiceDIToken } from "../../services/dialogs/browser/dialogService.ts";
import { parseKeybinding } from "../../../platform/keybinding/common/keybindingRegistry.ts";

import type { CommandAction } from "../../../platform/actions/common/commandAction.ts";

/**
 * Выход из приложения. Интерфейсный шов: Workbench объявляет, владелец приложения
 * (`WorkbenchComponent`: confirm-save через LifecycleService, затем teardown TUI +
 * exit) соответствует структурно; биндинг — в `Workbench/Modules/WorkbenchModule.ts`.
 */
export interface IQuitHandler {
    requestQuit(accessor: ServiceAccessor): void;
}

export const QuitHandlerDIToken = token<IQuitHandler>("QuitHandler");

export const quitAction: CommandAction = {
    id: "workbench.action.quit",
    title: "Quit",
    // Label только в меню — vscode-паттерн per-menu title override.
    menus: [{ menuId: MenuId.MenubarFileMenu, title: "Exit", group: "5_quit", order: 10 }],
    keybinding: parseKeybinding("ctrl+q"),
    run(accessor) {
        accessor.get(QuitHandlerDIToken).requestQuit(accessor);
    },
};

export const showAboutDialogAction: CommandAction = {
    id: "workbench.action.showAboutDialog",
    title: "About",
    menus: [{ menuId: MenuId.MenubarHelpMenu, group: "1_about", order: 10 }],
    run(accessor) {
        accessor.get(DialogServiceDIToken).showAboutDialog();
    },
};
