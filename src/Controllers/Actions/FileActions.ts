import type { CommandAction } from "../CommandAction.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { parseChord, parseKeybinding } from "../KeybindingRegistry.ts";
import { StatusBarControllerDIToken } from "../StatusBarController.ts";

export const fileSaveAction: CommandAction = {
    id: "workbench.action.files.save",
    title: "File: Save",
    keybinding: parseKeybinding("ctrl+s"),
    // Additional chord binding for save: Ctrl+K then S.
    keybindings: [parseChord("ctrl+k s")],
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.save();
        accessor.get(StatusBarControllerDIToken).update();
    },
};
