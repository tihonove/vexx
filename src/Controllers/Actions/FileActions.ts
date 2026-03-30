import type { CommandAction } from "../CommandAction.ts";
import { EditorControllerDIToken } from "../EditorController.ts";

export const fileSaveAction: CommandAction = {
    id: "workbench.action.files.save",
    title: "File: Save",
    keybinding: "ctrl+s",
    run(accessor) {
        accessor.get(EditorControllerDIToken).save();
    },
};
