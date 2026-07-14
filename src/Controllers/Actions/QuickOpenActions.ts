import type { CommandAction } from "../../vs/platform/commands/common/commandAction.ts";
import { parseChord, parseKeybinding } from "../../vs/platform/keybinding/common/keybindingsRegistry.ts";

export const quickOpenAction: CommandAction = {
    id: "workbench.action.quickOpen",
    title: "Go to File...",
    keybinding: parseKeybinding("ctrl+p"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const gotoLineAction: CommandAction = {
    id: "workbench.action.gotoLine",
    title: "Go to Line/Column...",
    keybinding: parseKeybinding("ctrl+g"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const showCommandsAction: CommandAction = {
    id: "workbench.action.showCommands",
    title: "Show All Commands",
    keybinding: parseKeybinding("ctrl+shift+p"),
    // Ctrl+Shift+letter is unreliable on legacy terminals — add the VS Code chord fallback.
    keybindings: [{ keys: parseChord("ctrl+k ctrl+p"), when: "tier == 'legacy'" }],
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};
