import * as path from "node:path";

import { ClipboardDIToken } from "../Services/CoreTokens.ts";
import type { CommandAction } from "./CommandAction.ts";
import { ExplorerServiceDIToken } from "../Services/ExplorerService.ts";
import { FileOperationsServiceDIToken } from "../Services/FileOperationsService.ts";
import { parseChord, parseKeybinding } from "../Services/KeybindingRegistry.ts";

/**
 * Команды copy/cut/paste для explorer поверх `FileOperationsService` (файловый
 * буфер + обратимые правки). Все под `listFocus`, так что ctrl+c/x/v не
 * конфликтуют с редакторскими (те под `textInputFocus`).
 */
export const fileCopyAction: CommandAction = {
    id: "fileOperations.copy",
    title: "File: Copy",
    keybinding: parseKeybinding("ctrl+c"),
    when: "listFocus",
    run(accessor) {
        accessor.get(FileOperationsServiceDIToken).copySelected();
    },
};

export const fileCutAction: CommandAction = {
    id: "fileOperations.cut",
    title: "File: Cut",
    keybinding: parseKeybinding("ctrl+x"),
    when: "listFocus",
    run(accessor) {
        accessor.get(FileOperationsServiceDIToken).cutSelected();
    },
};

export const filePasteAction: CommandAction = {
    id: "fileOperations.paste",
    title: "File: Paste",
    keybinding: parseKeybinding("ctrl+v"),
    when: "listFocus",
    run(accessor) {
        accessor.get(FileOperationsServiceDIToken).paste();
    },
};

/**
 * Копирует полный (абсолютный) путь выбранного файла в системный буфер обмена.
 * Байнд VS Code — Shift+Alt+C (специально не Ctrl+*, чтобы не схлопнуться с
 * `fileOperations.copy` на Ctrl+C в legacy-терминалах).
 */
export const fileCopyPathAction: CommandAction = {
    id: "fileOperations.copyPath",
    title: "File: Copy Path",
    keybinding: parseKeybinding("shift+alt+c"),
    when: "listFocus",
    run(accessor, ...args) {
        const filePath = (args[0] as string | undefined) ?? accessor.get(ExplorerServiceDIToken).getSelectedPaths()[0];
        if (filePath) void accessor.get(ClipboardDIToken).writeText(filePath);
    },
};

/**
 * Копирует путь выбранного файла относительно корня workspace в системный буфер обмена.
 * Байнд VS Code — аккорд Ctrl+K Ctrl+Shift+C; в legacy-терминалах вторая часть
 * не различает Shift, поэтому там fallback на Ctrl+K Ctrl+C.
 */
export const fileCopyRelativePathAction: CommandAction = {
    id: "fileOperations.copyRelativePath",
    title: "File: Copy Relative Path",
    keybinding: parseChord("ctrl+k ctrl+shift+c"),
    keybindings: [{ keys: parseChord("ctrl+k ctrl+c"), when: "tier == 'legacy'" }],
    when: "listFocus",
    run(accessor, ...args) {
        const explorer = accessor.get(ExplorerServiceDIToken);
        const filePath = (args[0] as string | undefined) ?? explorer.getSelectedPaths()[0];
        if (!filePath) return;
        const root = explorer.getRootPath();
        const relative = root ? path.relative(root, filePath) : filePath;
        void accessor.get(ClipboardDIToken).writeText(relative);
    },
};
