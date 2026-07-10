import { describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIMouseEvent } from "../TUIDom/Events/TUIMouseEvent.ts";

import { EditorElement } from "./EditorElement.ts";
import { EditorViewState } from "./EditorViewState.ts";
import { createFoldingRegion } from "./IFoldingRegion.ts";
import { TextDocument } from "./TextDocument.ts";

const CHEVRON_EXPANDED = "";
const CHEVRON_COLLAPSED = "";
const COLLAPSED_MARKER = "⋯";

function createEditor(
    text: string,
    regions: { start: number; end: number; collapsed?: boolean }[] = [],
    width = 20,
    height = 6,
): { app: TestApp; editor: EditorElement } {
    const doc = new TextDocument(text);
    const viewState = new EditorViewState(doc);
    viewState.setFoldingRegions(regions.map((r) => createFoldingRegion(r.start, r.end, r.collapsed)));
    const editor = new EditorElement(viewState);
    const app = TestApp.createWithContent(editor, new Size(width, height));
    return { app, editor };
}

function fireMouseDown(editor: EditorElement, localX: number, localY: number): void {
    editor.dispatchEvent(
        new TUIMouseEvent("mousedown", {
            button: "left",
            screenX: localX,
            screenY: localY,
            localX,
            localY,
        }),
    );
}

describe("EditorElement – folding gutter", () => {
    it("draws a down chevron on an expanded region header", () => {
        const { app, editor } = createEditor("a\n  b\n  c\nd", [{ start: 0, end: 2 }]);
        app.render();
        const gw = editor.gutterWidth;
        expect(app.backend.getTextAt(new Point(gw - 1, 0), 1)).toBe(CHEVRON_EXPANDED);
    });

    it("draws a right chevron on a collapsed region header", () => {
        const { app, editor } = createEditor("a\n  b\n  c\nd", [{ start: 0, end: 2, collapsed: true }]);
        app.render();
        const gw = editor.gutterWidth;
        expect(app.backend.getTextAt(new Point(gw - 1, 0), 1)).toBe(CHEVRON_COLLAPSED);
    });

    it("leaves a blank separator on non-foldable lines", () => {
        const { app, editor } = createEditor("a\n  b\n  c\nd", [{ start: 0, end: 2 }]);
        app.render();
        const gw = editor.gutterWidth;
        // Line 3 ("d") is not a header.
        expect(app.backend.getTextAt(new Point(gw - 1, 3), 1)).toBe(" ");
    });

    it("draws the collapsed marker after the header content and hides the body", () => {
        const { app, editor } = createEditor("a\n  b\n  c\nd", [{ start: 0, end: 2, collapsed: true }]);
        app.render();
        const gw = editor.gutterWidth;
        // "a" occupies one column; marker sits one column further (gap of 1).
        expect(app.backend.getTextAt(new Point(gw + 2, 0), 1)).toBe(COLLAPSED_MARKER);
        // Row 1 now shows the next visible logical line ("d"), body lines hidden.
        expect(app.backend.getTextAt(new Point(gw, 1), 1)).toBe("d");
    });

    it("does not draw the collapsed marker while expanded", () => {
        const { app, editor } = createEditor("a\n  b\n  c\nd", [{ start: 0, end: 2 }]);
        app.render();
        const gw = editor.gutterWidth;
        expect(app.backend.getTextAt(new Point(gw + 2, 0), 1)).not.toBe(COLLAPSED_MARKER);
    });

    it("omits the collapsed marker when it would fall outside the viewport", () => {
        // Header wider than the content area → marker column is off-screen.
        const { app, editor } = createEditor("aaaaaaaaaa\n  b\n  c\nd", [{ start: 0, end: 2, collapsed: true }], 12, 6);
        app.render();
        const gw = editor.gutterWidth;
        for (let x = gw; x < 12; x++) {
            expect(app.backend.getTextAt(new Point(x, 0), 1)).not.toBe(COLLAPSED_MARKER);
        }
    });
});

describe("EditorElement – folding mouse toggle", () => {
    it("toggles a region when its gutter chevron is clicked", () => {
        const { editor } = createEditor("a\n  b\n  c\nd", [{ start: 0, end: 2 }]);
        const gw = editor.gutterWidth;
        expect(editor.viewState.foldedRegions[0].isCollapsed).toBe(false);

        fireMouseDown(editor, gw - 1, 0);
        expect(editor.viewState.foldedRegions[0].isCollapsed).toBe(true);

        fireMouseDown(editor, gw - 1, 0);
        expect(editor.viewState.foldedRegions[0].isCollapsed).toBe(false);
    });

    it("does not move the cursor when toggling via the gutter", () => {
        const { editor } = createEditor("a\n  b\n  c\nd", [{ start: 0, end: 2 }]);
        const gw = editor.gutterWidth;
        fireMouseDown(editor, gw - 1, 0);
        const sel = editor.viewState.selections[0];
        expect(sel.active).toEqual({ line: 0, character: 0 });
    });

    it("places the cursor normally when the gutter column is not a header", () => {
        const { editor } = createEditor("a\n  b\n  c\nd", [{ start: 0, end: 2 }]);
        const gw = editor.gutterWidth;
        // Row 3 ("d") is not a header — clicking the fold column falls back to cursor placement.
        fireMouseDown(editor, gw - 1, 3);
        expect(editor.viewState.foldedRegions[0].isCollapsed).toBe(false);
        expect(editor.viewState.selections[0].active.line).toBe(3);
    });

    it("ignores a fold-column click below the last line", () => {
        const { editor } = createEditor("a\n  b\n  c\nd", [{ start: 0, end: 2 }], 20, 8);
        const gw = editor.gutterWidth;
        // Row 6 is past the 4-line document — no region toggles, no throw.
        fireMouseDown(editor, gw - 1, 6);
        expect(editor.viewState.foldedRegions[0].isCollapsed).toBe(false);
    });
});
