import type { CommandAction } from "../CommandAction.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { FileTreeControllerDIToken } from "../FileTreeController.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

/**
 * Открывает контекстное меню редактора с клавиатуры (Shift+F10, как в VS Code),
 * заякорив его на каретке. Тот же набор пунктов, что и по правому клику.
 */
export const showEditorContextMenuAction: CommandAction = {
    id: "editor.action.showContextMenu",
    title: "Show Editor Context Menu",
    keybinding: parseKeybinding("shift+f10"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.showContextMenu();
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
        accessor.get(FileTreeControllerDIToken).openContextMenuAtSelection();
    },
};
