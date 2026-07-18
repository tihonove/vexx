import * as fs from "node:fs";

import type { CommandAction } from "../CommandAction.ts";
import { parseKeybinding } from "../../Workbench/Services/KeybindingRegistry.ts";

export const fileDeleteAction: CommandAction = {
    id: "fileOperations.deleteFile",
    title: "File: Delete",
    keybinding: parseKeybinding("delete"),
    when: "listFocus",
    run(_accessor, filePath: unknown) {
        fs.rmSync(filePath as string, { recursive: true, force: true });
    },
};

/**
 * Переименование файла/каталога (VS Code `renameFile`, F2). `run` привязывается в
 * AppController — нужны QuickInput (ввод имени) и WorkspaceEditService (undoable).
 */
export const fileRenameAction = {
    id: "fileOperations.rename",
    title: "File: Rename",
    keybinding: parseKeybinding("f2"),
    when: "listFocus",
} satisfies Omit<CommandAction, "run">;
