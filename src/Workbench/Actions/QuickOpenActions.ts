import { parseChord, parseKeybinding } from "../Services/KeybindingRegistry.ts";
import { QuickOpenServiceDIToken } from "../Services/QuickOpenService.ts";

import type { CommandAction } from "./CommandAction.ts";

export const quickOpenAction: CommandAction = {
    id: "workbench.action.quickOpen",
    title: "Go to File...",
    keybinding: parseKeybinding("ctrl+p"),
    run(accessor) {
        accessor.get(QuickOpenServiceDIToken).open("files");
    },
};

export const gotoLineAction: CommandAction = {
    id: "workbench.action.gotoLine",
    title: "Go to Line/Column...",
    keybinding: parseKeybinding("ctrl+g"),
    run(accessor) {
        accessor.get(QuickOpenServiceDIToken).open("line");
    },
};

export const showCommandsAction: CommandAction = {
    id: "workbench.action.showCommands",
    title: "Show All Commands",
    keybinding: parseKeybinding("ctrl+shift+p"),
    // Ctrl+Shift+letter is unreliable on legacy terminals — add the VS Code chord fallback.
    keybindings: [{ keys: parseChord("ctrl+k ctrl+p"), when: "tier == 'legacy'" }],
    run(accessor) {
        accessor.get(QuickOpenServiceDIToken).open("commands");
    },
};
