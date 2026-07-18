import type { CommandAction } from "../CommandAction.ts";
import { parseChord, parseKeybinding } from "../../Workbench/Services/KeybindingRegistry.ts";

/**
 * Open the user settings.json (VS Code `workbench.action.openSettings`). Vexx has
 * no settings UI, so the command opens the JSON file directly. Default binding
 * matches VS Code (Ctrl+,). The real handler is installed by `AppController`;
 * this only declares id / title / binding.
 */
export const openSettingsAction: CommandAction = {
    id: "workbench.action.openSettings",
    title: "Preferences: Open User Settings",
    keybinding: parseKeybinding("ctrl+,"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime (needs the resolved settings path) */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};

/**
 * Open the user keybindings.json (VS Code `workbench.action.openGlobalKeybindings`).
 * As with settings, we open the JSON file directly. Default chord matches VS Code
 * (Ctrl+K Ctrl+S). The real handler is installed by `AppController`.
 */
export const openKeybindingsAction: CommandAction = {
    id: "workbench.action.openGlobalKeybindings",
    title: "Preferences: Open Keyboard Shortcuts",
    keybinding: parseChord("ctrl+k ctrl+s"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime (needs the resolved keybindings path) */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};
