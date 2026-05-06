import type { CommandAction } from "../CommandAction.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

export const nextEditorInGroupAction: CommandAction = {
    id: "workbench.action.nextEditorInGroup",
    title: "Next Editor In Group",
    keybinding: parseKeybinding("ctrl+tab"),
    keybindings: [parseKeybinding("ctrl+pagedown"), parseKeybinding("alt+pagedown")],
    when: "textInputFocus && editorTabsMultiple",
    run(accessor) {
        const group = accessor.get(EditorGroupControllerDIToken);
        if (group.editorCount < 2) return;

        const nextIndex = (group.activeIndex + 1) % group.editorCount;
        group.activateTab(nextIndex);
    },
};

export const previousEditorInGroupAction: CommandAction = {
    id: "workbench.action.previousEditorInGroup",
    title: "Previous Editor In Group",
    keybinding: parseKeybinding("ctrl+shift+tab"),
    keybindings: [parseKeybinding("ctrl+pageup"), parseKeybinding("alt+pageup")],
    when: "textInputFocus && editorTabsMultiple",
    run(accessor) {
        const group = accessor.get(EditorGroupControllerDIToken);
        if (group.editorCount < 2) return;

        const previousIndex = (group.activeIndex - 1 + group.editorCount) % group.editorCount;
        group.activateTab(previousIndex);
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
