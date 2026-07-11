import type { CommandAction } from "../CommandAction.ts";

/**
 * Дескрипторы команд создания в explorer (без `run` — он привязывается в
 * AppController, где доступны FileTreeController, QuickInput и WorkspaceEditService).
 * Без кейбиндингов: вызываются из контекст-меню дерева и палитры команд, как
 * `explorer.newFile`/`explorer.newFolder` в VS Code. Под `listFocus`.
 */
export const explorerNewFileAction = {
    id: "explorer.newFile",
    title: "File: New File",
    when: "listFocus",
} satisfies Omit<CommandAction, "run">;

export const explorerNewFolderAction = {
    id: "explorer.newFolder",
    title: "File: New Folder",
    when: "listFocus",
} satisfies Omit<CommandAction, "run">;
