import { describe, expect, it } from "vitest";

import { EditorViewState } from "./EditorViewState.ts";
import { createCursorSelection } from "./ISelection.ts";
import { TextDocument } from "./TextDocument.ts";

function makeDoc(lineCount: number): TextDocument {
    const lines = Array.from({ length: lineCount }, (_, i) => `line ${i}`);
    return new TextDocument(lines.join("\n"));
}

function makeState(lineCount: number, cursorLine = 0, viewportHeight = 10): EditorViewState {
    const doc = makeDoc(lineCount);
    const state = new EditorViewState(doc, [createCursorSelection(cursorLine, 0)]);
    state.viewportHeight = viewportHeight;
    return state;
}

describe("EditorViewState.cursorPageDown", () => {
    it("moves cursor down by viewportHeight - 1 lines", () => {
        const state = makeState(50, 0, 10);
        state.cursorPageDown();
        expect(state.selections[0].active.line).toBe(9);
    });

    it("does not go past the last line", () => {
        const state = makeState(15, 10, 10);
        state.cursorPageDown();
        expect(state.selections[0].active.line).toBe(14);
    });

    it("stays at last line when already there", () => {
        const state = makeState(5, 4, 10);
        state.cursorPageDown();
        expect(state.selections[0].active.line).toBe(4);
    });

    it("preserves idealColumn", () => {
        const doc = new TextDocument("short\nabcdefghij\nhi\nworld is big\nmore lines\neven more\nand more\nstill going\nkeep on\nnine\nten long line");
        const state = new EditorViewState(doc, [createCursorSelection(1, 8)]);
        state.viewportHeight = 5;

        state.cursorPageDown();
        // Should try to land on column 8, but line 5 ("even more") has length 9 so char=8
        expect(state.selections[0].active.line).toBe(5);
        expect(state.selections[0].active.character).toBe(8);
    });

    it("supports selection mode", () => {
        const state = makeState(50, 5, 10);
        state.cursorPageDown(true);
        expect(state.selections[0].active.line).toBe(14);
        expect(state.selections[0].anchor.line).toBe(5);
    });

    it("works with viewportHeight = 1", () => {
        const state = makeState(10, 0, 1);
        state.cursorPageDown();
        expect(state.selections[0].active.line).toBe(1);
    });

    it("scrolls viewport to keep cursor visible", () => {
        const state = makeState(50, 0, 10);
        state.cursorPageDown();
        // Cursor is at line 9, viewport should have scrolled
        expect(state.scrollTop).toBeGreaterThanOrEqual(0);
        expect(state.selections[0].active.line).toBeGreaterThanOrEqual(state.scrollTop);
        expect(state.selections[0].active.line).toBeLessThan(state.scrollTop + state.viewportHeight);
    });
});

describe("EditorViewState.cursorPageUp", () => {
    it("moves cursor up by viewportHeight - 1 lines", () => {
        const state = makeState(50, 20, 10);
        state.cursorPageUp();
        expect(state.selections[0].active.line).toBe(11);
    });

    it("does not go before line 0", () => {
        const state = makeState(50, 3, 10);
        state.cursorPageUp();
        expect(state.selections[0].active.line).toBe(0);
    });

    it("stays at line 0 when already there", () => {
        const state = makeState(5, 0, 10);
        state.cursorPageUp();
        expect(state.selections[0].active.line).toBe(0);
    });

    it("supports selection mode", () => {
        const state = makeState(50, 20, 10);
        state.cursorPageUp(true);
        expect(state.selections[0].active.line).toBe(11);
        expect(state.selections[0].anchor.line).toBe(20);
    });
});
