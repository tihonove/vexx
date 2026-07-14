import type { CommandAction } from "../../../../platform/commands/common/commandAction.ts";
import { parseChord, parseKeybinding } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";

export const fileSaveAction: CommandAction = {
    id: "workbench.action.files.save",
    title: "File: Save",
    keybinding: parseKeybinding("ctrl+s"),
    // Additional chord binding for save: Ctrl+K then S.
    keybindings: [parseChord("ctrl+k s")],
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime (conflict-aware save needs the overwrite dialog) */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};

export const newUntitledFileAction: CommandAction = {
    id: "workbench.action.files.newUntitledFile",
    title: "File: New Untitled File",
    keybinding: parseKeybinding("ctrl+n"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime (needs the editor group) */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
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

export const fileOpenAction: CommandAction = {
    id: "workbench.action.files.openFile",
    title: "File: Open File...",
    keybinding: parseKeybinding("ctrl+o"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime (needs QuickInput path prompt) */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};

export const fileOpenFolderAction: CommandAction = {
    id: "workbench.action.files.openFolder",
    title: "File: Open Folder...",
    keybinding: parseChord("ctrl+k ctrl+o"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime (needs QuickInput path prompt) */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};
