import type { CommandAction } from "../CommandAction.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { parseChord, parseKeybinding } from "../KeybindingRegistry.ts";

export const foldAction: CommandAction = {
    id: "editor.fold",
    title: "Fold",
    keybinding: parseKeybinding("ctrl+shift+["),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.foldAtCursor();
    },
};

export const unfoldAction: CommandAction = {
    id: "editor.unfold",
    title: "Unfold",
    keybinding: parseKeybinding("ctrl+shift+]"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.unfoldAtCursor();
    },
};

export const toggleFoldAction: CommandAction = {
    id: "editor.toggleFold",
    title: "Toggle Fold",
    keybinding: parseChord("ctrl+k ctrl+l"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.toggleFoldAtCursor();
    },
};

export const foldAllAction: CommandAction = {
    id: "editor.foldAll",
    title: "Fold All",
    keybinding: parseChord("ctrl+k ctrl+0"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.foldAll();
    },
};

export const unfoldAllAction: CommandAction = {
    id: "editor.unfoldAll",
    title: "Unfold All",
    keybinding: parseChord("ctrl+k ctrl+j"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.unfoldAll();
    },
};
