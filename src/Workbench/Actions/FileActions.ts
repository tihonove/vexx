import * as fs from "node:fs";

import { token } from "../../Common/DiContainer.ts";
import type { ServiceAccessor } from "../../Common/DiContainer.ts";

import { FileOperationsServiceDIToken } from "../Services/FileOperationsService.ts";
import { CommandRegistryDIToken } from "../Services/CommandRegistry.ts";
import { parseChord, parseKeybinding } from "../Services/KeybindingRegistry.ts";
import { QuickInputServiceDIToken } from "../Services/QuickInputService.ts";
import type { CommandAction } from "./CommandAction.ts";

/**
 * Смена папки воркспейса (Open Folder). Интерфейсный шов: Workbench объявляет,
 * владелец приложения (сейчас `AppController`: дерево, стейт, поисковый индекс,
 * cwd терминалов) соответствует структурно; биндинг — в
 * `Controllers/Modules/WorkbenchModule.ts`.
 */
export interface IWorkspaceFolderOpener {
    setWorkspaceFolder(dirPath: string): void;
}

export const WorkspaceFolderOpenerDIToken = token<IWorkspaceFolderOpener>("WorkspaceFolderOpener");

/**
 * Open File flow: prompt for a path (InputBox), validate it points at an
 * existing file, then open it in the active editor group (команда
 * `workbench.openFile`). The prompt opens empty; a relative path is resolved
 * against the workspace root.
 */
async function runOpenFile(accessor: ServiceAccessor): Promise<void> {
    const quickInput = accessor.get(QuickInputServiceDIToken);
    const fileOperations = accessor.get(FileOperationsServiceDIToken);

    const target = await quickInput.input({
        title: "Open File",
        placeholder: "Enter a file path",
        validateInput: (value) => {
            const resolved = fileOperations.resolveInputPath(value);
            // Empty is not flagged (fresh prompt shows no error); Enter is a no-op.
            if (!resolved) return null;
            if (!fs.existsSync(resolved)) return `File does not exist: ${resolved}`;
            if (fs.statSync(resolved).isDirectory()) return "That is a folder, not a file";
            return null;
        },
    });
    if (target === undefined) return;
    // An accepted-but-empty value resolves to null → nothing to open.
    const resolved = fileOperations.resolveInputPath(target);
    if (resolved) accessor.get(CommandRegistryDIToken).execute("workbench.openFile", resolved);
}

/**
 * Open Folder flow: prompt for a path (InputBox), validate it points at an
 * existing directory, then swap the workspace root to it (file tree, side
 * panel and the Quick Open search index all re-target the new folder).
 */
async function runOpenFolder(accessor: ServiceAccessor): Promise<void> {
    const quickInput = accessor.get(QuickInputServiceDIToken);
    const fileOperations = accessor.get(FileOperationsServiceDIToken);

    const target = await quickInput.input({
        title: "Open Folder",
        placeholder: "Enter a folder path",
        validateInput: (value) => {
            const resolved = fileOperations.resolveInputPath(value);
            // Empty is not flagged (fresh prompt shows no error); Enter is a no-op.
            if (!resolved) return null;
            if (!fs.existsSync(resolved)) return `Folder does not exist: ${resolved}`;
            if (!fs.statSync(resolved).isDirectory()) return "That is a file, not a folder";
            return null;
        },
    });
    if (target === undefined) return;
    // An accepted-but-empty value resolves to null → nothing to swap to.
    const resolved = fileOperations.resolveInputPath(target);
    if (resolved) accessor.get(WorkspaceFolderOpenerDIToken).setWorkspaceFolder(resolved);
}

export const fileOpenAction: CommandAction = {
    id: "workbench.action.files.openFile",
    title: "File: Open File...",
    keybinding: parseKeybinding("ctrl+o"),
    run(accessor) {
        void runOpenFile(accessor);
    },
};

export const fileOpenFolderAction: CommandAction = {
    id: "workbench.action.files.openFolder",
    title: "File: Open Folder...",
    keybinding: parseChord("ctrl+k ctrl+o"),
    run(accessor) {
        void runOpenFolder(accessor);
    },
};
