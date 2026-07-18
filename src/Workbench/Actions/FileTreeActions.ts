import type { CommandAction } from "./CommandAction.ts";
import { ExplorerComponentDIToken } from "../Components/Explorer/ExplorerComponent.ts";
import { ExplorerServiceDIToken } from "../Services/ExplorerService.ts";
import { FileOperationsServiceDIToken } from "../Services/FileOperationsService.ts";
import { parseKeybinding } from "../Services/KeybindingRegistry.ts";

/**
 * Удаление файла/каталога из explorer'а: подтверждение + запись в историю отмены
 * (см. `FileOperationsService.requestDeleteFile`). Без аргумента берёт выбранный
 * в дереве путь.
 */
export const fileDeleteAction: CommandAction = {
    id: "fileOperations.deleteFile",
    title: "File: Delete",
    keybinding: parseKeybinding("delete"),
    when: "listFocus",
    run(accessor, filePath: unknown) {
        const target = (filePath as string | undefined) ?? accessor.get(ExplorerServiceDIToken).getSelectedPaths()[0];
        if (target) accessor.get(FileOperationsServiceDIToken).requestDeleteFile(target);
    },
};

/** Переименование файла/каталога (VS Code `renameFile`, F2) через промпт нового имени. */
export const fileRenameAction: CommandAction = {
    id: "fileOperations.rename",
    title: "File: Rename",
    keybinding: parseKeybinding("f2"),
    when: "listFocus",
    run(accessor, filePath: unknown) {
        const target = (filePath as string | undefined) ?? accessor.get(ExplorerServiceDIToken).getSelectedPaths()[0];
        if (target) void accessor.get(FileOperationsServiceDIToken).runRename(target);
    },
};

/**
 * Перечитать содержимое дерева с диска (внешние изменения, которые live-watcher
 * мог пропустить — сетевые шары, игнорируемые пути). Без кейбиндинга: палитра
 * команд и контекстное меню дерева.
 */
export const refreshExplorerAction: CommandAction = {
    id: "workbench.files.action.refreshFilesExplorer",
    title: "File: Refresh Explorer",
    run(accessor) {
        void accessor.get(ExplorerServiceDIToken).refresh();
    },
};

/** Отмена последней файловой операции (workspace-undo); деструктивную — переспрашивает. */
export const fileUndoAction: CommandAction = {
    id: "fileOperations.undo",
    title: "File: Undo",
    keybinding: parseKeybinding("ctrl+z"),
    when: "listFocus",
    run(accessor) {
        accessor.get(FileOperationsServiceDIToken).undoWorkspace();
    },
};

/** Повтор последней отменённой файловой операции (workspace-redo). */
export const fileRedoAction: CommandAction = {
    id: "fileOperations.redo",
    title: "File: Redo",
    keybindings: [parseKeybinding("ctrl+shift+z"), parseKeybinding("ctrl+y")],
    when: "listFocus",
    run(accessor) {
        accessor.get(FileOperationsServiceDIToken).redoWorkspace();
    },
};

/**
 * Открывает контекстное меню дерева файлов с клавиатуры (Shift+F10), заякорив его на
 * выделенной строке. `when: listFocus` разводит бинд с редакторным по фокусу.
 */
export const showExplorerContextMenuAction: CommandAction = {
    id: "filesExplorer.openContextMenu",
    title: "Show Explorer Context Menu",
    keybinding: parseKeybinding("shift+f10"),
    when: "listFocus",
    run(accessor) {
        accessor.get(ExplorerComponentDIToken).openContextMenuAtSelection();
    },
};
