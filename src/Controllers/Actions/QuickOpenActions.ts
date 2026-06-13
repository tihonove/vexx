import type { CommandAction } from "../CommandAction.ts";
import { parseChord, parseKeybinding } from "../KeybindingRegistry.ts";

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
    // Ctrl+Shift+letter is unreliable on legacy terminals — add the VS Code chord fallback.
    keybindings: [{ keys: parseChord("ctrl+k ctrl+p"), when: "tier == 'legacy'" }],
    run() {
        // Overridden in AppController
    },
};
