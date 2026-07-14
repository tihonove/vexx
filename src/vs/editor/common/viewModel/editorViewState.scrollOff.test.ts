import { describe, expect, it } from "vitest";

import { EditorViewState } from "./editorViewState.ts";
import { createCursorSelection } from "../core/selection.ts";
import { TextDocument } from "../model/textDocument.ts";

function makeDoc(lineCount: number): TextDocument {
    const lines = Array.from({ length: lineCount }, (_, i) => `line ${String(i)}`);
    return new TextDocument(lines.join("\n"));
}

function makeState(
    lineCount: number,
    cursorLine: number,
    viewportHeight: number,
    surroundingLines: number,
): EditorViewState {
    const doc = makeDoc(lineCount);
    const state = new EditorViewState(doc, [createCursorSelection(cursorLine, 0)]);
    state.viewportHeight = viewportHeight;
    state.cursorSurroundingLines = surroundingLines;
    return state;
}

describe("EditorViewState cursorSurroundingLines — reveal margin", () => {
    it("keeps a margin above the cursor when paging up", () => {
        const state = makeState(100, 50, 10, 3);
        // Land the viewport at the bottom, then page up.
        state.scrollTop = 45;
        state.cursorPageUp();
        // Cursor moved to line 41; there should be 3 lines above it in view.
        expect(state.selections[0].active.line).toBe(41);
        expect(state.scrollTop).toBe(38);
    });

    it("keeps a margin below the cursor when paging down", () => {
        const state = makeState(100, 0, 10, 3);
        state.cursorPageDown();
        // Cursor moved to line 9; bottom edge is scrollTop + 9, so 3 blank-ish
        // lines of margin below → scrollTop = 9 - (10 - 1) + 3 = 3.
        expect(state.selections[0].active.line).toBe(9);
        expect(state.scrollTop).toBe(3);
        expect(state.selections[0].active.line).toBeLessThan(state.scrollTop + state.viewportHeight);
    });

    it("steps back from the very end (Ctrl+End) by scrolling past the last line", () => {
        const state = makeState(100, 0, 10, 3);
        state.cursorBottom();
        // Last line is 99. Without a margin scrollTop would be 90; the margin
        // pushes it 3 further so 3 blank lines show below the last line.
        expect(state.selections[0].active.line).toBe(99);
        expect(state.scrollTop).toBe(93);
    });

    it("does not scroll above line 0 near the document start", () => {
        const state = makeState(100, 30, 10, 3);
        state.scrollTop = 25;
        state.cursorTop();
        // Ctrl+Home: cursor at line 0, cannot show 3 lines above → clamp to 0.
        expect(state.selections[0].active.line).toBe(0);
        expect(state.scrollTop).toBe(0);
    });

    it("does not add a margin when the whole document fits in the viewport", () => {
        const state = makeState(5, 0, 20, 3);
        state.cursorBottom();
        expect(state.selections[0].active.line).toBe(4);
        expect(state.scrollTop).toBe(0);
    });

    it("caps the margin at half the viewport so the cursor never leaves view", () => {
        // viewportHeight 5 → maxMargin = floor((5-1)/2) = 2, even though 10 requested.
        const state = makeState(100, 0, 5, 10);
        state.cursorPageDown();
        const cursorLine = state.selections[0].active.line;
        expect(cursorLine).toBeGreaterThanOrEqual(state.scrollTop);
        expect(cursorLine).toBeLessThan(state.scrollTop + state.viewportHeight);
    });

    it("behaves like the old edge-glued reveal when set to 0", () => {
        const state = makeState(100, 0, 10, 0);
        state.cursorPageDown();
        expect(state.selections[0].active.line).toBe(9);
        // No margin → cursor glued to the bottom edge, scrollTop = 9 - 10 + 1 = 0.
        expect(state.scrollTop).toBe(0);
    });
});
