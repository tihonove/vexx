import type { CommandAction } from "../../Workbench/Actions/CommandAction.ts";
import { parseChord, parseKeybinding } from "../../Workbench/Services/KeybindingRegistry.ts";

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

// fileOpenAction / fileOpenFolderAction переехали в Workbench/Actions/FileActions.ts
// (этап 8): их флоу целиком живёт на Workbench-сервисах (QuickInputService,
// FileOperationsService) и шве IWorkspaceFolderOpener.
