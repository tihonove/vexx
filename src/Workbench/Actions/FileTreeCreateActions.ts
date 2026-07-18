import { FileOperationsServiceDIToken } from "../Services/FileOperationsService.ts";

import type { CommandAction } from "./CommandAction.ts";

/**
 * Команды создания в explorer поверх `FileOperationsService.runCreate` (промпт
 * имени + обратимое создание). Без кейбиндингов: вызываются из контекст-меню
 * дерева и палитры команд, как `explorer.newFile`/`explorer.newFolder` в VS Code.
 * Под `listFocus`.
 */
export const explorerNewFileAction: CommandAction = {
    id: "explorer.newFile",
    title: "File: New File",
    when: "listFocus",
    run(accessor, ...args) {
        void accessor.get(FileOperationsServiceDIToken).runCreate("file", args[0] as string | undefined);
    },
};

export const explorerNewFolderAction: CommandAction = {
    id: "explorer.newFolder",
    title: "File: New Folder",
    when: "listFocus",
    run(accessor, ...args) {
        void accessor.get(FileOperationsServiceDIToken).runCreate("folder", args[0] as string | undefined);
    },
};
