import type { CommandAction } from "../CommandAction.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

export const quickOpenAction: CommandAction = {
    id: "workbench.action.quickOpen",
    title: "Go to File...",
    keybinding: parseKeybinding("ctrl+p"),
    run() {
        // Overridden in AppController
    },
};

export const showCommandsAction: CommandAction = {
    id: "workbench.action.showCommands",
    title: "Show All Commands",
    keybinding: parseKeybinding("ctrl+shift+p"),
    run() {
        // Overridden in AppController
    },
};
