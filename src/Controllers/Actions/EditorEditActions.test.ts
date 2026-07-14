import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Container } from "../../vs/platform/instantiation/common/instantiation.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../Configuration/NullConfigurationService.ts";
import { createCursorSelection, createSelection } from "../../Editor/ISelection.ts";
import { NULL_LANGUAGE_SERVICE } from "../../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../TestUtils/TempWorkspace.ts";
import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { ThemeService } from "../../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { CommandAction } from "../CommandAction.ts";
import { registerAction } from "../CommandAction.ts";
import { CommandRegistry } from "../CommandRegistry.ts";
import { EditorGroupController } from "../EditorGroupController.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { NULL_FILE_WATCHER } from "../IFileWatcher.ts";
import { KeybindingRegistry } from "../KeybindingRegistry.ts";
import { UndoRedoService } from "../Workspace/UndoRedoService.ts";

import {
    deleteLeftAction,
    deleteRightAction,
    deleteWordLeftAction,
    deleteWordRightAction,
    indentLinesAction,
    outdentLinesAction,
    redoAction,
    selectAllAction,
    undoAction,
} from "./EditorEditActions.ts";

let ws: ITempWorkspace;

function createGroup(): EditorGroupController {
    const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    return new EditorGroupController(
        themeService,
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
        NULL_CONFIGURATION_SERVICE,
        new UndoRedoService(),
        NULL_FILE_WATCHER,
    );
}

function openEditor(content: string) {
    const ctrl = createGroup();
    ctrl.mount();
    const filePath = ws.writeFile("doc.txt", content);
    ctrl.openFile(filePath);
    const editor = ctrl.getActiveEditor();
    if (editor === null) throw new Error("no active editor");

    const commands = new CommandRegistry();
    const keybindings = new KeybindingRegistry();
    const accessor = new Container();
    accessor.bind(EditorGroupControllerDIToken, () => ctrl);

    function exec(action: CommandAction): void {
        registerAction(commands, keybindings, accessor, action);
        commands.execute(action.id);
    }
    return { ctrl, editor, exec };
}

beforeEach(() => {
    ws = createTempWorkspace({ prefix: "vexx-editor-edit-actions-" });
});
afterEach(() => {
    ws.dispose();
});

describe("EditorEditActions — deletion mutates the real document", () => {
    it("deleteLeft removes the character before the cursor", () => {
        const { editor, exec } = openEditor("hello world");
        editor.viewState.selections = [createCursorSelection(0, 5)];
        exec(deleteLeftAction);
        expect(editor.getText()).toBe("hell world");
        expect(editor.viewState.selections[0].active).toEqual({ line: 0, character: 4 });
    });

    it("deleteRight removes the character after the cursor", () => {
        const { editor, exec } = openEditor("hello world");
        editor.viewState.selections = [createCursorSelection(0, 5)];
        exec(deleteRightAction);
        expect(editor.getText()).toBe("helloworld");
        expect(editor.viewState.selections[0].active).toEqual({ line: 0, character: 5 });
    });

    it("deleteWordLeft removes the word before the cursor", () => {
        const { editor, exec } = openEditor("hello world");
        editor.viewState.selections = [createCursorSelection(0, 11)];
        exec(deleteWordLeftAction);
        expect(editor.getText()).toBe("hello ");
    });

    it("deleteWordRight removes the word after the cursor", () => {
        const { editor, exec } = openEditor("hello world");
        editor.viewState.selections = [createCursorSelection(0, 0)];
        exec(deleteWordRightAction);
        expect(editor.getText()).toBe("world");
    });

    it("delete actions are safe no-ops without an active editor", () => {
        const ctrl = createGroup();
        ctrl.mount();
        const commands = new CommandRegistry();
        const accessor = new Container();
        accessor.bind(EditorGroupControllerDIToken, () => ctrl);
        // Cover the `if (editor)` false branch of every editing action.
        for (const action of [
            deleteLeftAction,
            deleteRightAction,
            deleteWordLeftAction,
            deleteWordRightAction,
            indentLinesAction,
            outdentLinesAction,
        ]) {
            registerAction(commands, new KeybindingRegistry(), accessor, action);
            expect(() => commands.execute(action.id)).not.toThrow();
        }
    });

    it("deleteWordLeft / deleteWordRight are no-ops at the document edges", () => {
        const { editor, exec } = openEditor("word");
        // deleteWordLeft at column 0 — nothing to the left.
        editor.viewState.selections = [createCursorSelection(0, 0)];
        exec(deleteWordLeftAction);
        expect(editor.getText()).toBe("word");

        // deleteWordRight at end of document — nothing to the right.
        editor.viewState.selections = [createCursorSelection(0, 4)];
        exec(deleteWordRightAction);
        expect(editor.getText()).toBe("word");
    });
});

describe("EditorEditActions — indent / outdent", () => {
    it("indentLines inserts a tab at a collapsed cursor", () => {
        const { editor, exec } = openEditor("hello");
        editor.viewState.selections = [createCursorSelection(0, 0)];
        exec(indentLinesAction);
        expect(editor.getText()).toBe("\thello");
    });

    it("indentLines prepends indent to every line of a multi-line selection", () => {
        const { editor, exec } = openEditor("aa\nbb");
        editor.viewState.selections = [createSelection(0, 0, 1, 2)];
        exec(indentLinesAction);
        expect(editor.getText()).toBe("\taa\n\tbb");
    });

    it("outdentLines removes one indent level from the cursor's line", () => {
        const { editor, exec } = openEditor("\thello");
        editor.viewState.selections = [createCursorSelection(0, 3)];
        exec(outdentLinesAction);
        expect(editor.getText()).toBe("hello");
    });

    it("outdentLines is a safe no-op on an unindented line", () => {
        const { editor, exec } = openEditor("hello");
        editor.viewState.selections = [createCursorSelection(0, 0)];
        exec(outdentLinesAction);
        expect(editor.getText()).toBe("hello");
    });

    it("outdent then undo restores the removed indentation", () => {
        const { editor, exec } = openEditor("\thello");
        editor.viewState.selections = [createCursorSelection(0, 3)];
        exec(outdentLinesAction);
        expect(editor.getText()).toBe("hello");
        exec(undoAction);
        expect(editor.getText()).toBe("\thello");
    });
});

describe("EditorEditActions — undo / redo round-trip", () => {
    it("undo restores deleted text and redo re-applies it", () => {
        const { editor, exec } = openEditor("hello world");
        editor.viewState.selections = [createCursorSelection(0, 5)];

        exec(deleteLeftAction);
        expect(editor.getText()).toBe("hell world");

        exec(undoAction);
        expect(editor.getText()).toBe("hello world");

        exec(redoAction);
        expect(editor.getText()).toBe("hell world");
    });
});

describe("EditorEditActions — selectAll", () => {
    it("selects the entire document", () => {
        const { editor, exec } = openEditor("hello\nworld!");
        editor.viewState.selections = [createCursorSelection(0, 0)];

        exec(selectAllAction);

        const sel = editor.viewState.selections[0];
        expect(sel.anchor).toEqual({ line: 0, character: 0 });
        expect(sel.active).toEqual({ line: 1, character: "world!".length });
        expect(editor.viewState.getSelectedText()).toBe("hello\nworld!");
    });

    it("makes a real selection that deleteLeft then removes wholesale", () => {
        const { editor, exec } = openEditor("hello world");
        editor.viewState.selections = [createSelection(0, 0, 0, 11)];
        exec(deleteLeftAction);
        expect(editor.getText()).toBe("");
    });
});
