import type { CommandAction } from "../../Workbench/Actions/CommandAction.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { parseChord, parseKeybinding } from "../../Workbench/Services/KeybindingRegistry.ts";

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

export const foldRecursivelyAction: CommandAction = {
    id: "editor.foldRecursively",
    title: "Fold Recursively",
    keybinding: parseChord("ctrl+k ctrl+["),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.foldRecursivelyAtCursor();
    },
};

export const unfoldRecursivelyAction: CommandAction = {
    id: "editor.unfoldRecursively",
    title: "Unfold Recursively",
    keybinding: parseChord("ctrl+k ctrl+]"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.unfoldRecursivelyAtCursor();
    },
};

/** Builds an `editor.foldLevelN` action bound to Ctrl+K Ctrl+N (VS Code parity, N = 1..7). */
function makeFoldLevelAction(level: number): CommandAction {
    return {
        id: `editor.foldLevel${String(level)}`,
        title: `Fold Level ${String(level)}`,
        keybinding: parseChord(`ctrl+k ctrl+${String(level)}`),
        when: "textInputFocus",
        run(accessor) {
            accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.foldLevel(level);
        },
    };
}

export const foldLevelActions: CommandAction[] = [1, 2, 3, 4, 5, 6, 7].map(makeFoldLevelAction);

// Go to next/previous foldable region. VS Code ships these unbound; we bind them
// to Ctrl+K Ctrl+. / Ctrl+K Ctrl+, (easy to rebind).
export const gotoNextFoldAction: CommandAction = {
    id: "editor.gotoNextFold",
    title: "Go to Next Fold",
    keybinding: parseChord("ctrl+k ctrl+."),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.gotoNextFold();
    },
};

export const gotoPreviousFoldAction: CommandAction = {
    id: "editor.gotoPreviousFold",
    title: "Go to Previous Fold",
    keybinding: parseChord("ctrl+k ctrl+,"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.gotoPreviousFold();
    },
};
