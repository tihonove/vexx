import type { CommandAction } from "../../../platform/commands/common/commandAction.ts";
import { TuiApplicationDIToken } from "../coreTokens.ts";
import { parseKeybinding } from "../../../platform/keybinding/common/keybindingsRegistry.ts";

export const quitAction: CommandAction = {
    id: "workbench.action.quit",
    title: "Quit",
    keybinding: parseKeybinding("ctrl+q"),
    run(accessor) {
        accessor.get(TuiApplicationDIToken).backend.teardown();
        process.exit(0);
    },
};
