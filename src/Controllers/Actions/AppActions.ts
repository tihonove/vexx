import type { CommandAction } from "../../Workbench/Actions/CommandAction.ts";
import { TuiApplicationDIToken } from "../../Workbench/Services/CoreTokens.ts";
import { parseKeybinding } from "../../Workbench/Services/KeybindingRegistry.ts";

export const quitAction: CommandAction = {
    id: "workbench.action.quit",
    title: "Quit",
    keybinding: parseKeybinding("ctrl+q"),
    run(accessor) {
        accessor.get(TuiApplicationDIToken).backend.teardown();
        process.exit(0);
    },
};
