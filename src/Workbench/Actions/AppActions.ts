import type { ServiceAccessor } from "../../Common/DiContainer.ts";
import { token } from "../../Common/DiContainer.ts";
import { DialogServiceDIToken } from "../Services/DialogService.ts";
import { parseKeybinding } from "../Services/KeybindingRegistry.ts";

import type { CommandAction } from "./CommandAction.ts";

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
    keybinding: parseKeybinding("ctrl+q"),
    run(accessor) {
        accessor.get(QuitHandlerDIToken).requestQuit(accessor);
    },
};

export const showAboutDialogAction: CommandAction = {
    id: "workbench.action.showAboutDialog",
    title: "About",
    run(accessor) {
        accessor.get(DialogServiceDIToken).showAboutDialog();
    },
};
