import type { CommandAction } from "../CommandAction.ts";
import { TuiApplicationDIToken } from "../CoreTokens.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

export const quitAction: CommandAction = {
    id: "workbench.action.quit",
    title: "Quit",
    keybinding: parseKeybinding("ctrl+q"),
    run(accessor) {
        accessor.get(TuiApplicationDIToken).backend.teardown();
        process.exit(0);
    },
};
