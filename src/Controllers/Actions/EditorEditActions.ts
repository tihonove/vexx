import type { CommandAction } from "../CommandAction.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

// ─── Delete ─────────────────────────────────────────────────

export const deleteLeftAction: CommandAction = {
    id: "deleteLeft",
    title: "Delete Left",
    keybinding: parseKeybinding("backspace"),
    when: "textInputFocus",
    run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        if (editor) {
            editor.pushUndo(editor.viewState.deleteLeft());
        }
    },
};

export const deleteRightAction: CommandAction = {
    id: "deleteRight",
    title: "Delete Right",
    keybinding: parseKeybinding("delete"),
    when: "textInputFocus",
    run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        if (editor) {
            editor.pushUndo(editor.viewState.deleteRight());
        }
    },
};

export const deleteWordLeftAction: CommandAction = {
    id: "deleteWordLeft",
    title: "Delete Word Left",
    keybinding: parseKeybinding("ctrl+backspace"),
    when: "textInputFocus",
    run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        if (editor) {
            editor.pushUndo(editor.viewState.deleteWordLeft());
        }
    },
};

export const deleteWordRightAction: CommandAction = {
    id: "deleteWordRight",
    title: "Delete Word Right",
    keybinding: parseKeybinding("ctrl+delete"),
    when: "textInputFocus",
    run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        if (editor) {
            editor.pushUndo(editor.viewState.deleteWordRight());
        }
    },
};

// ─── Undo / Redo ────────────────────────────────────────────

export const undoAction: CommandAction = {
    id: "undo",
    title: "Undo",
    keybinding: parseKeybinding("ctrl+z"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.undo();
    },
};

export const redoAction: CommandAction = {
    id: "redo",
    title: "Redo",
    keybinding: parseKeybinding("ctrl+shift+z"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.redo();
    },
};

// ─── Selection ──────────────────────────────────────────────

export const selectAllAction: CommandAction = {
    id: "editor.action.selectAll",
    title: "Select All",
    keybinding: parseKeybinding("ctrl+a"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.selectAll();
    },
};
