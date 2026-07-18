import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Container } from "../../Common/DiContainer.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../Configuration/NullConfigurationService.ts";
import { NULL_LANGUAGE_SERVICE } from "../../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../TestUtils/TempWorkspace.ts";
import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { ThemeService } from "../../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { CommandAction } from "../../Workbench/Actions/CommandAction.ts";
import { registerAction } from "../../Workbench/Actions/CommandAction.ts";
import { CommandRegistry } from "../../Workbench/Services/CommandRegistry.ts";
import { EditorService, EditorServiceDIToken } from "../../Workbench/Services/EditorService.ts";
import { NULL_FILE_WATCHER } from "../../Common/IFileWatcher.ts";
import { KeybindingRegistry } from "../../Workbench/Services/KeybindingRegistry.ts";
import { UndoRedoService } from "../../Workbench/Services/Workspace/UndoRedoService.ts";

import { redoAction, undoAction } from "./EditorEditActions.ts";
import { insertFinalNewLineAction, triggerSuggestAction, trimTrailingWhitespaceAction } from "./WhitespaceActions.ts";

let ws: ITempWorkspace;

function createGroup(): EditorService {
    const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    return new EditorService(
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
    const filePath = ws.writeFile("doc.txt", content);
    ctrl.openFile(filePath);
    const editor = ctrl.getActiveEditor();
    if (editor === null) throw new Error("no active editor");

    const commands = new CommandRegistry();
    const keybindings = new KeybindingRegistry();
    const accessor = new Container();
    accessor.bind(EditorServiceDIToken, () => ctrl);

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
        const commands = new CommandRegistry();
        const accessor = new Container();
        accessor.bind(EditorServiceDIToken, () => ctrl);
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
