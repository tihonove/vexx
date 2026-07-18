import * as fs from "node:fs";
import * as path from "node:path";

import type { ServiceAccessor } from "../../Common/DiContainer.ts";
import { token } from "../../Common/DiContainer.ts";
import { ILogServiceDIToken } from "../../Common/Logging/ILogServiceDIToken.ts";
import { Uri } from "../../Common/Uri.ts";
import { CommandRegistryDIToken } from "../Services/CommandRegistry.ts";
import { DialogServiceDIToken } from "../Services/DialogService.ts";
import { EditorServiceDIToken } from "../Services/EditorService.ts";
import { FileOperationsServiceDIToken } from "../Services/FileOperationsService.ts";
import { parseChord, parseKeybinding } from "../Services/KeybindingRegistry.ts";
import { QuickInputServiceDIToken } from "../Services/QuickInputService.ts";
import { WorkbenchContextKeysDIToken } from "../Services/WorkbenchContextKeys.ts";

import type { CommandAction } from "./CommandAction.ts";

/**
 * Смена папки воркспейса (Open Folder). Интерфейсный шов: Workbench объявляет,
 * владелец приложения (`WorkbenchComponent`: дерево, стейт, поисковый индекс,
 * cwd терминалов) соответствует структурно; биндинг — в
 * `Workbench/Modules/WorkbenchModule.ts`.
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

/**
 * Explicit Save (Ctrl+S / menu). Saves the active editor; if the file was
 * modified on disk by another process since it was opened, the write is
 * blocked (to avoid clobbering the parallel changes) and an Overwrite/Cancel
 * dialog is shown instead — mirroring VS Code's dirty-write protection.
 */
async function runSave(accessor: ServiceAccessor): Promise<void> {
    const editorService = accessor.get(EditorServiceDIToken);
    const editor = editorService.getActiveEditor();
    if (editor === null) return;
    const outcome = await editor.save();
    if (outcome === "no-file") {
        // Безымянный буфер (Ctrl+N) — пути ещё нет, уводим в Save As.
        await runSaveAs(accessor);
        return;
    }
    if (outcome === "conflict") {
        const name = editorService.displayName(editor);
        accessor.get(DialogServiceDIToken).showConfirmDialog(
            {
                title: "Overwrite",
                message: [
                    `The file "${name}" has been changed on disk.`,
                    "Do you want to overwrite the version on disk with your changes?",
                ],
                confirmLabel: "Overwrite",
                cancelLabel: "Cancel",
                defaultButton: "cancel",
            },
            {
                onConfirm: () => {
                    void editor.save({ overwrite: true });
                },
            },
        );
        return;
    }
}

/**
 * Save As flow: prompt for a target path (InputBox), confirm overwrite if a
 * different file already exists, then write via `TextFileModel.saveAs`.
 */
async function runSaveAs(accessor: ServiceAccessor): Promise<void> {
    const editorService = accessor.get(EditorServiceDIToken);
    const editor = editorService.getActiveEditor();
    if (!editor) return;

    // Безымянный буфер (Ctrl+N) не имеет пути — стартуем от cwd и предложенного
    // имени (`Untitled-3.txt`: метка буфера + расширение его языка).
    const seed =
        editor.uri.scheme === "file"
            ? editor.uri.fsPath
            : path.join(process.cwd(), editorService.suggestedSaveName(editor));
    const target = await accessor.get(QuickInputServiceDIToken).input({
        title: "Save As",
        placeholder: "Enter path to save",
        value: seed,
        validateInput: (value) => {
            const trimmed = value.trim();
            if (trimmed === "") return "Please enter a file name";
            const resolved = path.resolve(trimmed);
            const dir = path.dirname(resolved);
            if (!fs.existsSync(dir)) return `Directory does not exist: ${dir}`;
            if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
                return "A folder with that name already exists";
            }
            return null;
        },
    });
    if (target === undefined) return;

    const resolved = path.resolve(target.trim());
    const doSave = async (): Promise<void> => {
        try {
            await editor.saveAs(resolved);
            accessor.get(WorkbenchContextKeysDIToken).update();
        } catch (error) {
            /* v8 ignore start -- defensive: surfaces a filesystem write failure (permissions/disk); not reproducible in tests */
            accessor
                .get(ILogServiceDIToken)
                .createLogger("input.keybindings")
                .error("Save As failed", { path: resolved, error: String(error) });
            /* v8 ignore stop */
        }
    };

    // Overwriting a *different* existing file → confirm first. Сравниваем ресурсы,
    // а не сырые строки: `resolved` уже абсолютный, но канонизацию даёт Uri.
    if (Uri.file(resolved).toString() !== editor.uri.toString() && fs.existsSync(resolved)) {
        accessor.get(DialogServiceDIToken).showConfirmDialog(
            {
                title: "Save As",
                message: `${path.basename(resolved)} already exists. Overwrite?`,
                confirmLabel: "Overwrite",
                cancelLabel: "Cancel",
            },
            { onConfirm: () => void doSave() },
        );
        return;
    }
    void doSave();
}

export const fileSaveAction: CommandAction = {
    id: "workbench.action.files.save",
    title: "File: Save",
    keybinding: parseKeybinding("ctrl+s"),
    // Additional chord binding for save: Ctrl+K then S.
    keybindings: [parseChord("ctrl+k s")],
    run(accessor) {
        void runSave(accessor);
    },
};

export const newUntitledFileAction: CommandAction = {
    id: "workbench.action.files.newUntitledFile",
    title: "File: New Untitled File",
    keybinding: parseKeybinding("ctrl+n"),
    run(accessor) {
        accessor.get(EditorServiceDIToken).newUntitled();
        accessor.get(WorkbenchContextKeysDIToken).update();
    },
};

export const fileSaveAsAction: CommandAction = {
    id: "workbench.action.files.saveAs",
    title: "File: Save As...",
    keybinding: parseKeybinding("ctrl+shift+s"),
    run(accessor) {
        void runSaveAs(accessor);
    },
};

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
