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

export const fileSaveAsAction: CommandAction = {
    id: "workbench.action.files.saveAs",
    title: "File: Save As...",
    keybinding: parseKeybinding("ctrl+shift+s"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime (needs QuickInput + confirm dialog) */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};
