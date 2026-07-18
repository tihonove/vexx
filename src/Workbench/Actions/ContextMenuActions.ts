import type { CommandAction } from "./CommandAction.ts";
import { EditorServiceDIToken } from "../Services/EditorService.ts";
import { parseKeybinding } from "../Services/KeybindingRegistry.ts";

/**
 * Открывает контекстное меню редактора с клавиатуры (Shift+F10, как в VS Code),
 * заякорив его на каретке. Тот же набор пунктов, что и по правому клику.
 * Explorer-собрат — `showExplorerContextMenuAction` в `FileTreeActions.ts`.
 */
export const showEditorContextMenuAction: CommandAction = {
    id: "editor.action.showContextMenu",
    title: "Show Editor Context Menu",
    keybinding: parseKeybinding("shift+f10"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.showContextMenu();
    },
};
