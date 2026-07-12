import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { createRange } from "../Editor/IRange.ts";
import { NULL_LANGUAGE_SERVICE } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { EditorController } from "./EditorController.ts";
import { UndoRedoService } from "./Workspace/UndoRedoService.ts";

const BAR = "▎";
const CHANGE_COLOR = packRgb(0x1b, 0x81, 0xa8);

function createEditorController(): EditorController {
    return new EditorController(
        new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)),
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
        new UndoRedoService(),
    );
}

describe("EditorController — setGutterChangeDecorations", () => {
    let ws: ITempWorkspace;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-gutterchange-" });
    });

    afterEach(() => {
        ws.dispose();
    });

    it("forwards decorations to the editor so a bar paints, and marks it dirty for a repaint", () => {
        const ctrl = createEditorController();
        ctrl.openFile(ws.writeFile("a.txt", "l0\nl1\nl2"));

        const app = TestApp.createWithContent(ctrl.view, new Size(20, 3));
        app.render();
        // Layout is clean after the initial paint — the setter must mark it dirty
        // again so the app schedules a repaint.
        expect(ctrl.view.isLayoutDirty).toBe(false);

        ctrl.setGutterChangeDecorations([{ range: createRange(1, 0, 1, 0), color: CHANGE_COLOR }]);
        expect(ctrl.view.isLayoutDirty).toBe(true);

        app.render();
        expect(app.backend.getTextAt(new Point(0, 1), 1)).toBe(BAR);
        expect(app.backend.getFgAt(new Point(0, 1))).toBe(CHANGE_COLOR);
    });
});
