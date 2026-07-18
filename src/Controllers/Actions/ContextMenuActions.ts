import type { CommandAction } from "../../Workbench/Actions/CommandAction.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { parseKeybinding } from "../../Workbench/Services/KeybindingRegistry.ts";

/**
 * Открывает контекстное меню редактора с клавиатуры (Shift+F10, как в VS Code),
 * заякорив его на каретке. Тот же набор пунктов, что и по правому клику.
 *
 * Остаётся в Controllers/Actions: тянет ещё не мигрированный
 * `EditorGroupController` (этап 9). Explorer-собрат — `showExplorerContextMenuAction`
 * в `Workbench/Actions/FileTreeActions.ts`.
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
