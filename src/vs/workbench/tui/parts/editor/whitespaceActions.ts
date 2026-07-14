import { createDeleteEdit, createInsertEdit, type ITextEdit } from "../../../../editor/common/core/textEdit.ts";
import type { CommandAction } from "../../../../platform/commands/common/commandAction.ts";
import { EditorGroupControllerDIToken } from "./editorGroupController.ts";
import { parseKeybinding } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";

// ─── Whitespace ─────────────────────────────────────────────
//
// Core editor commands that the editorconfig extension (and users) invoke via
// the command palette / executeCommand. They carry no default keybindings.

/**
 * Removes trailing spaces and tabs from every line of the active document.
 * Matches VS Code's `editor.action.trimTrailingWhitespace`.
 */
export const trimTrailingWhitespaceAction: CommandAction = {
    id: "editor.action.trimTrailingWhitespace",
    title: "Trim Trailing Whitespace",
    when: "textInputFocus",
    run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        if (!editor) return;

        const lines = editor.getText().split("\n");
        const edits: ITextEdit[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLength = line.replace(/[ \t]+$/, "").length;
            if (trimmedLength < line.length) {
                edits.push(createDeleteEdit(i, trimmedLength, i, line.length));
            }
        }
        editor.applyExternalEdits(edits, "Trim Trailing Whitespace");
    },
};

/**
 * Ensures the active document ends with exactly one final newline.
 * Matches VS Code's `editor.action.insertFinalNewLine`.
 */
export const insertFinalNewLineAction: CommandAction = {
    id: "editor.action.insertFinalNewLine",
    title: "Insert Final Newline",
    when: "textInputFocus",
    run(accessor) {
        const editor = accessor.get(EditorGroupControllerDIToken).getActiveEditor();
        if (!editor) return;

        const text = editor.getText();
        if (text.length === 0 || text.endsWith("\n")) return;

        const lines = text.split("\n");
        const lastLine = lines.length - 1;
        editor.applyExternalEdits([createInsertEdit(lastLine, lines[lastLine].length, "\n")], "Insert Final Newline");
    },
};

/**
 * Открывает completion-попап у каретки (`editor.action.triggerSuggest`).
 *
 * Реальный обработчик устанавливает `AppController` (делегирует в
 * `CompletionController.trigger()`) — как у quick-open/find. Здесь только
 * плейсхолдер `run` и дефолтный кейбинд Ctrl+Space (при фокусе редактора).
 * Команда также вызывается расширениями (editorconfig после вставки свойства).
 */
export const triggerSuggestAction: CommandAction = {
    id: "editor.action.triggerSuggest",
    title: "Trigger Suggest",
    keybinding: parseKeybinding("ctrl+space"),
    when: "textInputFocus",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};
