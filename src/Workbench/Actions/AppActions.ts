import type { CommandAction } from "./CommandAction.ts";
import { TuiApplicationDIToken } from "../Services/CoreTokens.ts";
import { DialogServiceDIToken } from "../Services/DialogService.ts";
import { parseKeybinding } from "../Services/KeybindingRegistry.ts";

/**
 * Немедленный выход (teardown TUI + exit). WorkbenchComponent перекрывает `run`
 * confirm-save последовательностью (`requestQuit` через LifecycleService) —
 * здесь остаётся «голый» выход для окружений без несохранённых буферов.
 */
export const quitAction: CommandAction = {
    id: "workbench.action.quit",
    title: "Quit",
    keybinding: parseKeybinding("ctrl+q"),
    run(accessor) {
        accessor.get(TuiApplicationDIToken).backend.teardown();
        process.exit(0);
    },
};

export const showAboutDialogAction: CommandAction = {
    id: "workbench.action.showAboutDialog",
    title: "About",
    run(accessor) {
        accessor.get(DialogServiceDIToken).showAboutDialog();
    },
};
