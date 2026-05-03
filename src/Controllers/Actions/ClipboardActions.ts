import type { CommandAction } from "../CommandAction.ts";
import { ClipboardDIToken } from "../CoreTokens.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

export const clipboardCopyAction: CommandAction = {
    id: "editor.action.clipboardCopyAction",
    title: "Copy",
    keybinding: parseKeybinding("ctrl+c"),
    when: "textInputFocus",
    async run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        if (!editor) return;
        const text = editor.viewState.getSelectedText();
        if (text !== "") {
            await accessor.get(ClipboardDIToken).writeText(text);
        }
    },
};

export const clipboardCutAction: CommandAction = {
    id: "editor.action.clipboardCutAction",
    title: "Cut",
    keybinding: parseKeybinding("ctrl+x"),
    when: "textInputFocus",
    async run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        if (!editor) return;
        const text = editor.viewState.getSelectedText();
        if (text === "") return;
        await accessor.get(ClipboardDIToken).writeText(text);
        const undo = editor.viewState.deleteLeft();
        if (undo) {
            editor.pushUndo(undo);
        }
    },
};

export const clipboardPasteAction: CommandAction = {
    id: "editor.action.clipboardPasteAction",
    title: "Paste",
    keybinding: parseKeybinding("ctrl+v"),
    when: "textInputFocus",
    async run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        if (!editor) return;
        const text = await accessor.get(ClipboardDIToken).readText();
        if (text !== "") {
            editor.pushUndo(editor.viewState.insertText(text));
        }
    },
};
