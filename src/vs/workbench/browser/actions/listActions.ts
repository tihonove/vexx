import { TreeViewElement } from "../../../../../tuidom/ui/tree/treeViewElement.ts";
import type { CommandAction } from "../../../platform/actions/common/commandAction.ts";
import { parseKeybinding } from "../../../platform/keybinding/common/keybindingRegistry.ts";
import { TuiApplicationDIToken } from "../../common/coreTokens.ts";

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

export const listFocusFirstAction: CommandAction = {
    id: "list.focusFirst",
    title: "List: Focus First",
    keybinding: parseKeybinding("home"),
    when: "listFocus",
    run(accessor) {
        const app = accessor.get(TuiApplicationDIToken);
        const active = app.focusManager?.activeElement;
        if (active instanceof TreeViewElement) {
            active.focusFirst();
        }
    },
};

export const listFocusLastAction: CommandAction = {
    id: "list.focusLast",
    title: "List: Focus Last",
    keybinding: parseKeybinding("end"),
    when: "listFocus",
    run(accessor) {
        const app = accessor.get(TuiApplicationDIToken);
        const active = app.focusManager?.activeElement;
        if (active instanceof TreeViewElement) {
            active.focusLast();
        }
    },
};
