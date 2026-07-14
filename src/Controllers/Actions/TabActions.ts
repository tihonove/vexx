import type { ServiceAccessor } from "../../vs/platform/instantiation/common/instantiation.ts";
import type { CommandAction } from "../../vs/platform/commands/common/commandAction.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { parseKeybinding } from "../../vs/platform/keybinding/common/keybindingsRegistry.ts";
import { ModifierReleaseArmoryDIToken } from "../../vs/platform/keybinding/common/modifierReleaseArmory.ts";

/**
 * Один шаг MRU-переключения вкладок. Каждое нажатие шагает по стеку, а отпускание
 * удерживающего модификатора (Ctrl для Ctrl+Tab, Alt для ребинда Alt+Tab и т.п.)
 * фиксирует выбор — так быстрые нажатия тумблерят два последних редактора, а
 * удержание проходит вглубь. Модификатор берётся из контекста текущего вызова
 * (см. ModifierReleaseArmory); из меню/палитры контекста нет — тогда шаг без
 * «hold-сессии».
 */
function cycleMruStep(accessor: ServiceAccessor, direction: 1 | -1): void {
    const group = accessor.get(EditorGroupControllerDIToken);
    group.cycleMru(direction);
    accessor.get(ModifierReleaseArmoryDIToken).armOnHoldRelease(() => {
        group.endMruCycle();
    });
}

export const nextEditorInGroupAction: CommandAction = {
    id: "workbench.action.nextEditorInGroup",
    title: "Next Editor In Group",
    keybinding: parseKeybinding("ctrl+tab"),
    keybindings: [parseKeybinding("ctrl+pagedown"), parseKeybinding("alt+pagedown")],
    when: "textInputFocus && editorTabsMultiple",
    run(accessor) {
        cycleMruStep(accessor, 1);
    },
};

export const previousEditorInGroupAction: CommandAction = {
    id: "workbench.action.previousEditorInGroup",
    title: "Previous Editor In Group",
    keybinding: parseKeybinding("ctrl+shift+tab"),
    keybindings: [parseKeybinding("ctrl+pageup"), parseKeybinding("alt+pageup")],
    when: "textInputFocus && editorTabsMultiple",
    run(accessor) {
        cycleMruStep(accessor, -1);
    },
};

export const closeActiveEditorAction: CommandAction = {
    id: "workbench.action.closeActiveEditor",
    title: "Close Active Editor",
    keybinding: parseKeybinding("ctrl+w"),
    when: "textInputFocus && editorGroupHasEditors",
    run(accessor) {
        const group = accessor.get(EditorGroupControllerDIToken);
        if (group.editorCount === 0 || group.activeIndex < 0) return;

        const editor = group.getActiveEditor();
        if (editor?.isModified && group.onRequestConfirmClose) {
            group.onRequestConfirmClose(group.activeIndex);
        } else {
            group.closeTab(group.activeIndex);
        }
    },
};
