import { TreeViewElement } from "../../TUIDom/Widgets/TreeViewElement.ts";
import type { CommandAction } from "../CommandAction.ts";
import { TuiApplicationDIToken } from "../CoreTokens.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

export const listFocusPageDownAction: CommandAction = {
    id: "list.focusPageDown",
    title: "List: Page Down",
    keybinding: parseKeybinding("pagedown"),
    when: "listFocus",
    run(accessor) {
        const app = accessor.get(TuiApplicationDIToken);
        const active = app.focusManager?.activeElement;
        if (active instanceof TreeViewElement) {
            active.focusPageDown();
        }
    },
};

export const listFocusPageUpAction: CommandAction = {
    id: "list.focusPageUp",
    title: "List: Page Up",
    keybinding: parseKeybinding("pageup"),
    when: "listFocus",
    run(accessor) {
        const app = accessor.get(TuiApplicationDIToken);
        const active = app.focusManager?.activeElement;
        if (active instanceof TreeViewElement) {
            active.focusPageUp();
        }
    },
};
