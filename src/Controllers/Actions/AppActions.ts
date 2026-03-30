import type { CommandAction } from "../CommandAction.ts";
import { TuiApplicationDIToken } from "../CoreTokens.ts";

export const quitAction: CommandAction = {
    id: "workbench.action.quit",
    title: "Quit",
    keybinding: "ctrl+q",
    run(accessor) {
        accessor.get(TuiApplicationDIToken).backend.teardown();
        process.exit(0);
    },
};
