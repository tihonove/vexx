import { explorerPathArg } from "../../../browser/actions/menuContexts.ts";
import { MenuId } from "../../../../platform/actions/common/menuId.ts";
import { FileOperationsServiceDIToken } from "./fileOperationsService.ts";

import type { CommandAction } from "../../../../platform/actions/common/commandAction.ts";

/**
 * Команды создания в explorer поверх `FileOperationsService.runCreate` (промпт
 * имени + обратимое создание). Без кейбиндингов: вызываются из контекст-меню
 * дерева и палитры команд, как `explorer.newFile`/`explorer.newFolder` в VS Code.
 * Под `listFocus`.
 */
export const explorerNewFileAction: CommandAction = {
    id: "explorer.newFile",
    title: "File: New File",
    shortTitle: "New File...",
    when: "listFocus",
    menus: [
        { menuId: MenuId.ExplorerContext, group: "1_new", order: 10, args: explorerPathArg },
        // В меню-баре контекст открытия undefined — без args (создание в корне).
        { menuId: MenuId.MenubarFileMenu, group: "1_new", order: 20 },
    ],
    run(accessor, ...args) {
        void accessor.get(FileOperationsServiceDIToken).runCreate("file", args[0] as string | undefined);
    },
};

export const explorerNewFolderAction: CommandAction = {
    id: "explorer.newFolder",
    title: "File: New Folder",
    shortTitle: "New Folder...",
    when: "listFocus",
    menus: [
        { menuId: MenuId.ExplorerContext, group: "1_new", order: 20, args: explorerPathArg },
        { menuId: MenuId.MenubarFileMenu, group: "1_new", order: 30 },
    ],
    run(accessor, ...args) {
        void accessor.get(FileOperationsServiceDIToken).runCreate("folder", args[0] as string | undefined);
    },
};
