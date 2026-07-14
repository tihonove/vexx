import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Point, Size } from "../../../../base/common/geometry.ts";
import { createRange } from "../../../../editor/common/core/range.ts";
import { NULL_LANGUAGE_SERVICE } from "../../../../editor/common/languages/language.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../../../editor/common/languages/tokenStyleResolver.ts";
import { TokenizationRegistry } from "../../../../editor/common/tokenizationRegistry.ts";
import { packRgb } from "../../../../tui/rendering/colorUtils.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../../../../TestUtils/TempWorkspace.ts";
import { TestApp } from "../../../../../TestUtils/TestApp.ts";
import { darkPlusTheme } from "../../../services/themes/common/themes/darkPlus.ts";
import { ThemeService } from "../../../services/themes/common/themeService.ts";
import { WorkbenchTheme } from "../../../services/themes/common/workbenchTheme.ts";

import { EditorController } from "./editorController.ts";
import { UndoRedoService } from "../../../../platform/undoRedo/common/undoRedoService.ts";

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
