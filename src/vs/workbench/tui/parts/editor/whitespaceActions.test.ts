import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Container } from "../../../../platform/instantiation/common/instantiation.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../../../platform/configuration/common/nullConfigurationService.ts";
import { NULL_LANGUAGE_SERVICE } from "../../../../editor/common/languages/language.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../../../editor/common/languages/tokenStyleResolver.ts";
import { TokenizationRegistry } from "../../../../editor/common/tokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../../../../TestUtils/TempWorkspace.ts";
import { darkPlusTheme } from "../../../services/themes/common/themes/darkPlus.ts";
import { ThemeService } from "../../../services/themes/common/themeService.ts";
import { WorkbenchTheme } from "../../../../platform/theme/common/workbenchTheme.ts";
import type { CommandAction } from "../../../../platform/commands/common/commandAction.ts";
import { registerAction } from "../../../../platform/commands/common/commandAction.ts";
import { CommandRegistry } from "../../../../platform/commands/common/commands.ts";
import { EditorGroupController } from "./editorGroupController.ts";
import { EditorGroupControllerDIToken } from "./editorGroupController.ts";
import { NULL_FILE_WATCHER } from "../../../../platform/files/common/watcher.ts";
import { KeybindingRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import { UndoRedoService } from "../../../../platform/undoRedo/common/undoRedoService.ts";

import { redoAction, undoAction } from "./editorEditActions.ts";
import { insertFinalNewLineAction, triggerSuggestAction, trimTrailingWhitespaceAction } from "./whitespaceActions.ts";

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
    ws = createTempWorkspace({ prefix: "vexx-whitespace-actions-" });
});
afterEach(() => {
    ws.dispose();
});

describe("WhitespaceActions — trimTrailingWhitespace", () => {
    it("removes trailing spaces and tabs from every line, leaving inner whitespace", () => {
        const { editor, exec } = openEditor("a b  \nc\td\t\n  keep  x   ");
        exec(trimTrailingWhitespaceAction);
        expect(editor.getText()).toBe("a b\nc\td\n  keep  x");
    });

    it("is a no-op on already-clean text (content and version unchanged)", () => {
        const { editor, exec } = openEditor("clean\nlines\n");
        expect(editor.isModified).toBe(false);
        exec(trimTrailingWhitespaceAction);
        expect(editor.getText()).toBe("clean\nlines\n");
        expect(editor.isModified).toBe(false);
    });
});

describe("WhitespaceActions — insertFinalNewLine", () => {
    it("appends a single trailing newline when missing", () => {
        const { editor, exec } = openEditor("no newline");
        exec(insertFinalNewLineAction);
        expect(editor.getText()).toBe("no newline\n");
    });

    it("is a no-op when a final newline already exists", () => {
        const { editor, exec } = openEditor("has newline\n");
        expect(editor.isModified).toBe(false);
        exec(insertFinalNewLineAction);
        expect(editor.getText()).toBe("has newline\n");
        expect(editor.isModified).toBe(false);
    });

    it("is a no-op on an empty document", () => {
        const { editor, exec } = openEditor("");
        exec(insertFinalNewLineAction);
        expect(editor.getText()).toBe("");
        expect(editor.isModified).toBe(false);
    });
});

describe("WhitespaceActions — undo / redo round-trip", () => {
    it("undo restores trailing whitespace and redo re-trims it", () => {
        const { editor, exec } = openEditor("trailing   \nspace  ");
        exec(trimTrailingWhitespaceAction);
        expect(editor.getText()).toBe("trailing\nspace");

        exec(undoAction);
        expect(editor.getText()).toBe("trailing   \nspace  ");

        exec(redoAction);
        expect(editor.getText()).toBe("trailing\nspace");
    });

    it("undo removes the inserted final newline", () => {
        const { editor, exec } = openEditor("line");
        exec(insertFinalNewLineAction);
        expect(editor.getText()).toBe("line\n");

        exec(undoAction);
        expect(editor.getText()).toBe("line");
    });
});

describe("WhitespaceActions — safety without an active editor", () => {
    it("trim / insertFinalNewLine / triggerSuggest do not throw with no active editor", () => {
        const ctrl = createGroup();
        ctrl.mount();
        const commands = new CommandRegistry();
        const accessor = new Container();
        accessor.bind(EditorGroupControllerDIToken, () => ctrl);
        for (const action of [trimTrailingWhitespaceAction, insertFinalNewLineAction, triggerSuggestAction]) {
            registerAction(commands, new KeybindingRegistry(), accessor, action);
            expect(() => commands.execute(action.id)).not.toThrow();
        }
    });
});

describe("WhitespaceActions — triggerSuggest", () => {
    it("is a no-op that leaves the document unchanged", () => {
        const { editor, exec } = openEditor("content");
        exec(triggerSuggestAction);
        expect(editor.getText()).toBe("content");
        expect(editor.isModified).toBe(false);
    });
});
