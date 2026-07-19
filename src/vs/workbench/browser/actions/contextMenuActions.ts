import type { CommandAction } from "../../../platform/actions/common/commandAction.ts";
import { parseKeybinding } from "../../../platform/keybinding/common/keybindingRegistry.ts";
import { EditorServiceDIToken } from "../../services/editor/browser/editorService.ts";

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
