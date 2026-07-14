import type { CommandAction } from "../../../../platform/commands/common/commandAction.ts";
import { parseChord } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";

/**
 * Open the color-theme picker (VS Code `workbench.action.selectTheme`). Default
 * chord matches VS Code (Ctrl+K Ctrl+T). The real handler is installed by
 * `AppController`; this only declares id / title / binding.
 */
export const selectThemeAction: CommandAction = {
    id: "workbench.action.selectTheme",
    title: "Preferences: Color Theme",
    keybinding: parseChord("ctrl+k ctrl+t"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};
