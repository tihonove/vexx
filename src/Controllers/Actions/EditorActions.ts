import type { CommandAction } from "../CommandAction.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

export const cursorPageDownAction: CommandAction = {
    id: "cursorPageDown",
    title: "Cursor Page Down",
    keybinding: parseKeybinding("pagedown"),
    when: "textInputFocus",
    run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        editor?.viewState.cursorPageDown();
    },
};

export const cursorPageUpAction: CommandAction = {
    id: "cursorPageUp",
    title: "Cursor Page Up",
    keybinding: parseKeybinding("pageup"),
    when: "textInputFocus",
    run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        editor?.viewState.cursorPageUp();
    },
};
