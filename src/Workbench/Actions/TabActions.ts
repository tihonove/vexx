import type { ServiceAccessor } from "../../Common/DiContainer.ts";
import type { CommandAction } from "./CommandAction.ts";
import { EditorServiceDIToken } from "../Services/EditorService.ts";
import { parseKeybinding } from "../Services/KeybindingRegistry.ts";
import { ModifierReleaseArmoryDIToken } from "../Services/ModifierReleaseArmory.ts";

/**
 * Один шаг MRU-переключения вкладок. Каждое нажатие шагает по стеку, а отпускание
 * удерживающего модификатора (Ctrl для Ctrl+Tab, Alt для ребинда Alt+Tab и т.п.)
 * фиксирует выбор — так быстрые нажатия тумблерят два последних редактора, а
 * удержание проходит вглубь. Модификатор берётся из контекста текущего вызова
 * (см. ModifierReleaseArmory); из меню/палитры контекста нет — тогда шаг без
 * «hold-сессии».
 */
function cycleMruStep(accessor: ServiceAccessor, direction: 1 | -1): void {
    const group = accessor.get(EditorServiceDIToken);
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
        const group = accessor.get(EditorServiceDIToken);
        if (group.editorCount === 0 || group.activeIndex < 0) return;

        const editor = group.getActiveEditor();
        if (editor?.isModified && group.onRequestConfirmClose) {
            group.onRequestConfirmClose(group.activeIndex);
        } else {
            group.closeTab(group.activeIndex);
        }
    },
};
