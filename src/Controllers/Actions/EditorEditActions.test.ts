import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Container } from "../../Common/DiContainer.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../Configuration/NullConfigurationService.ts";
import { createCursorSelection, createSelection } from "../../Editor/ISelection.ts";
import { NULL_LANGUAGE_SERVICE } from "../../Editor/Tokenization/ILanguageService.ts";
import { UndoRedoService } from "../Workspace/UndoRedoService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { ThemeService } from "../../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { CommandAction } from "../CommandAction.ts";
import { registerAction } from "../CommandAction.ts";
import { CommandRegistry } from "../CommandRegistry.ts";
import { EditorGroupController } from "../EditorGroupController.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { KeybindingRegistry } from "../KeybindingRegistry.ts";

import {
    deleteLeftAction,
    deleteRightAction,
    deleteWordLeftAction,
    deleteWordRightAction,
    redoAction,
    selectAllAction,
    undoAction,
} from "./EditorEditActions.ts";

let tmpDir: string;

function createGroup(): EditorGroupController {
    const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    return new EditorGroupController(
        themeService,
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
        NULL_CONFIGURATION_SERVICE,
        new UndoRedoService(),
    );
}

function openEditor(content: string) {
    const ctrl = createGroup();
    ctrl.mount();
    const filePath = path.join(tmpDir, "doc.txt");
    fs.writeFileSync(filePath, content, "utf-8");
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
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-editor-edit-actions-"));
});
afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
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
        // Cover the `if (editor)` false branch of every delete action (lines 27-53).
        for (const action of [deleteLeftAction, deleteRightAction, deleteWordLeftAction, deleteWordRightAction]) {
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
