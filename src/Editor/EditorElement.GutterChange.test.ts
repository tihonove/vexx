import { describe, expect, it } from "vitest";

import { Point, Size } from "../vs/base/common/geometry.ts";
import { packRgb } from "../vs/tui/rendering/colorUtils.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { EditorElement } from "./EditorElement.ts";
import { EditorViewState } from "./EditorViewState.ts";
import { createRange } from "./IRange.ts";
import { TextDocument } from "./TextDocument.ts";

const BAR = "▎";
const ADDED = packRgb(0x48, 0x7e, 0x02);
const MODIFIED = packRgb(0x1b, 0x81, 0xa8);
const DELETED = packRgb(0xf1, 0x4c, 0x4c);

function makeEditor(content: string): EditorElement {
    const doc = new TextDocument(content);
    const editor = new EditorElement(new EditorViewState(doc));
    editor.occurrenceHighlightEnabled = false;
    return editor;
}

function render(editor: EditorElement): TestApp {
    const app = TestApp.createWithContent(editor, new Size(40, 6));
    app.render();
    return app;
}

describe("EditorElement — gutter change-bars", () => {
    it("paints a coloured bar in the leftmost gutter column only on changed lines", () => {
        const editor = makeEditor("l0\nl1\nl2\nl3");
        editor.gutterChangeDecorations = [{ range: createRange(1, 0, 2, 0), color: MODIFIED }];

        const app = render(editor);

        // Lines 1 and 2 carry the bar in column 0, tinted with the change colour.
        for (const y of [1, 2]) {
            expect(app.backend.getTextAt(new Point(0, y), 1)).toBe(BAR);
            expect(app.backend.getFgAt(new Point(0, y))).toBe(MODIFIED);
        }
        // The lines just outside the range keep a blank gutter (no bar).
        expect(app.backend.getTextAt(new Point(0, 0), 1)).toBe(" ");
        expect(app.backend.getTextAt(new Point(0, 3), 1)).toBe(" ");
    });

    it("renders a deleted-hunk boundary as a single-line bar", () => {
        const editor = makeEditor("l0\nl1\nl2\nl3");
        editor.gutterChangeDecorations = [{ range: createRange(3, 0, 3, 0), color: DELETED }];

        const app = render(editor);

        expect(app.backend.getTextAt(new Point(0, 3), 1)).toBe(BAR);
        expect(app.backend.getFgAt(new Point(0, 3))).toBe(DELETED);
        expect(app.backend.getTextAt(new Point(0, 2), 1)).toBe(" ");
    });

    it("keeps the line number intact next to the bar", () => {
        const editor = makeEditor("l0\nl1\nl2\nl3");
        editor.gutterChangeDecorations = [{ range: createRange(0, 0, 0, 0), color: ADDED }];

        const app = render(editor);

        // Bar at column 0, then the fold-margin padding, then the "1" line number
        // (gutterWidth = 2 pad + 1 digit + 3 fold margin; digit sits at column 2).
        expect(app.backend.getTextAt(new Point(0, 0), 1)).toBe(BAR);
        expect(app.backend.getTextAt(new Point(2, 0), 1)).toBe("1");
    });

    it("draws no bars by default (empty decorations)", () => {
        const editor = makeEditor("l0\nl1");

        const app = render(editor);

        expect(app.backend.getTextAt(new Point(0, 0), 1)).toBe(" ");
        expect(app.backend.getTextAt(new Point(0, 1), 1)).toBe(" ");
    });
});
