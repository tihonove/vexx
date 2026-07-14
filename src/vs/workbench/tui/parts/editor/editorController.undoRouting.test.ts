import * as fs from "node:fs";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NULL_LANGUAGE_SERVICE } from "../../../../editor/common/languages/language.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../../../editor/common/languages/tokenStyleResolver.ts";
import { TokenizationRegistry } from "../../../../editor/common/tokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../../../../TestUtils/TempWorkspace.ts";
import { darkPlusTheme } from "../../../services/themes/common/themes/darkPlus.ts";
import { ThemeService } from "../../../services/themes/common/themeService.ts";
import { WorkbenchTheme } from "../../../../platform/theme/common/workbenchTheme.ts";

import { EditorController } from "./editorController.ts";
import { UndoRedoService, WORKSPACE_UNDO_CONTEXT } from "../../../../platform/undoRedo/common/undoRedoService.ts";

let tmpDir: string;
let ws: ITempWorkspace;

beforeEach(() => {
    ws = createTempWorkspace({ prefix: "vexx-editundo-" });
    tmpDir = ws.dir;
});

afterEach(() => {
    ws.dispose();
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

    it("routes undo under the 'untitled' context when no file is open", () => {
        const undoRedo = new UndoRedoService();
        const theme = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
        const controller = new EditorController(
            theme,
            new TokenizationRegistry(),
            NULL_TOKEN_STYLE_RESOLVER,
            NULL_LANGUAGE_SERVICE,
            undoRedo,
        );

        controller.pushUndo(controller.viewState.type("hi"));
        expect(undoRedo.canUndo("untitled")).toBe(true);

        controller.undo();
        expect(controller.getText()).toBe("");

        controller.dispose();
    });

    it("clears the file's history when the controller is disposed", () => {
        const { controller, undoRedo, file } = make();
        controller.pushUndo(controller.viewState.type("x"));
        expect(undoRedo.canUndo(file)).toBe(true);

        controller.dispose();
        expect(undoRedo.canUndo(file)).toBe(false);
    });
});
