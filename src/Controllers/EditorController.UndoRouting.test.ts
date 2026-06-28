import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NULL_LANGUAGE_SERVICE } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { EditorController } from "./EditorController.ts";
import { UndoRedoService, WORKSPACE_UNDO_CONTEXT } from "./Workspace/UndoRedoService.ts";

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-editundo-"));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function make(): { controller: EditorController; undoRedo: UndoRedoService; file: string } {
    const undoRedo = new UndoRedoService();
    const theme = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    const controller = new EditorController(
        theme,
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
        undoRedo,
    );
    const file = path.join(tmpDir, "a.txt");
    fs.writeFileSync(file, "");
    controller.openFile(file);
    return { controller, undoRedo, file };
}

describe("EditorController — text undo routes through the unified UndoRedoService", () => {
    it("registers a step under the file path and undo reverts via the service", () => {
        const { controller, undoRedo, file } = make();

        controller.pushUndo(controller.viewState.type("hello"));
        expect(controller.getText()).toBe("hello");
        expect(undoRedo.canUndo(file)).toBe(true);
        // Not registered under the workspace (file-operations) context.
        expect(undoRedo.canUndo(WORKSPACE_UNDO_CONTEXT)).toBe(false);

        controller.undo();
        expect(controller.getText()).toBe("");
        expect(undoRedo.canRedo(file)).toBe(true);
    });

    it("redo re-applies the edit", () => {
        const { controller } = make();
        controller.pushUndo(controller.viewState.type("abc"));
        controller.undo();
        expect(controller.getText()).toBe("");

        controller.redo();
        expect(controller.getText()).toBe("abc");
    });

    it("clears the file's history when the controller is disposed", () => {
        const { controller, undoRedo, file } = make();
        controller.pushUndo(controller.viewState.type("x"));
        expect(undoRedo.canUndo(file)).toBe(true);

        controller.dispose();
        expect(undoRedo.canUndo(file)).toBe(false);
    });
});
