import { describe, expect, it } from "vitest";

import { EditorViewState } from "./EditorViewState.ts";
import { createFoldingRegion } from "./IFoldingRegion.ts";
import { createCursorSelection, createSelection } from "./ISelection.ts";
import { TextDocument } from "./TextDocument.ts";
import { PlainTextTokenizer } from "./Tokenization/builtin/PlainTextTokenizer.ts";
import { DocumentTokenStore } from "./Tokenization/DocumentTokenStore.ts";

// ─── getViewLine / getViewLineTokens out-of-range ───────────

describe("EditorViewState.getViewLine — out of range", () => {
    it("returns empty string for a visual line past the end", () => {
        const doc = new TextDocument("a\nb");
        const state = new EditorViewState(doc);
        expect(state.getViewLine(99)).toBe("");
    });

    it("returns empty string for a negative visual line", () => {
        const doc = new TextDocument("a\nb");
        const state = new EditorViewState(doc);
        expect(state.getViewLine(-1)).toBe("");
    });
});

describe("EditorViewState.getViewLineTokens — out of range", () => {
    it("returns undefined when no token store is attached", () => {
        const doc = new TextDocument("a\nb");
        const state = new EditorViewState(doc);
        expect(state.getViewLineTokens(0)).toBeUndefined();
    });

    it("returns undefined for a visual line past the end even with a token store", () => {
        const doc = new TextDocument("a\nb");
        const state = new EditorViewState(doc);
        state.tokenStore = new DocumentTokenStore(doc, new PlainTextTokenizer());
        expect(state.getViewLineTokens(99)).toBeUndefined();
    });

    it("returns undefined for a negative visual line with a token store", () => {
        const doc = new TextDocument("a\nb");
        const state = new EditorViewState(doc);
        state.tokenStore = new DocumentTokenStore(doc, new PlainTextTokenizer());
        expect(state.getViewLineTokens(-1)).toBeUndefined();
    });
});

// ─── cursorRight on the final grapheme of a line ────────────

describe("EditorViewState.cursorRight — last-grapheme branch", () => {
    it("moves to line end when the cursor is on the final character", () => {
        // Single-char line: the active slot is the last slot, so cursorRight
        // falls through to newChar = lineLen rather than the next slot.
        const doc = new TextDocument("a\nbc");
        const state = new EditorViewState(doc, [createCursorSelection(0, 0)]);
        state.cursorRight();
        expect(state.selections[0].active).toEqual({ line: 0, character: 1 });
    });
});

// ─── deleteRight when offset has no slot (end of line fallback) ──

describe("EditorViewState.deleteRight — boundary", () => {
    it("merges with the next line when the cursor is at end of line", () => {
        const doc = new TextDocument("ab\ncd");
        const state = new EditorViewState(doc, [createCursorSelection(0, 2)]);
        state.deleteRight();
        expect(doc.getText()).toBe("abcd");
    });

    it("deletes the grapheme under the cursor mid-line", () => {
        const doc = new TextDocument("abc");
        const state = new EditorViewState(doc, [createCursorSelection(0, 1)]);
        state.deleteRight();
        expect(doc.getText()).toBe("ac");
    });
});

// ─── Navigation when the cursor sits on a hidden line ───────

describe("EditorViewState navigation from a collapsed (hidden) line", () => {
    it("cursorDown from a hidden line jumps to the first visible line below", () => {
        // Region (1,3) collapsed hides lines 2,3. Place the cursor on hidden line 2.
        const doc = new TextDocument("a\nb\nc\nd\ne");
        const state = new EditorViewState(doc, [createCursorSelection(2, 0)]);
        state.setFoldingRegions([createFoldingRegion(1, 3, true)]);

        state.cursorDown();
        // First visible line after line 2 is line 4 ("e").
        expect(state.selections[0].active.line).toBe(4);
    });

    it("cursorUp from a hidden line jumps to the last visible line above", () => {
        const doc = new TextDocument("a\nb\nc\nd\ne");
        const state = new EditorViewState(doc, [createCursorSelection(2, 0)]);
        state.setFoldingRegions([createFoldingRegion(1, 3, true)]);

        state.cursorUp();
        // Last visible line before hidden line 2 is the fold header, line 1 ("b").
        expect(state.selections[0].active.line).toBe(1);
    });
});

// ─── adjustFoldingRegionsForEdits branches ──────────────────

describe("EditorViewState folding adjustment on edits", () => {
    it("leaves a region untouched when the edit is entirely after it", () => {
        const doc = new TextDocument("a\nb\nc\nd\ne");
        const state = new EditorViewState(doc, [createCursorSelection(4, 1)]);
        state.setFoldingRegions([createFoldingRegion(0, 2, false)]);

        // Edit on line 4 — strictly after the region (0,2).
        state.type("X");

        expect(state.foldedRegions).toHaveLength(1);
        expect(state.foldedRegions[0]).toMatchObject({ startLine: 0, endLine: 2 });
    });

    it("removes a region when the edit starts inside it and extends beyond its end", () => {
        // Region (1,3). A selection from line 2 to line 5 replaced with text spans
        // from inside the region to beyond endLine → region is dropped.
        const doc = new TextDocument("a\nb\nc\nd\ne\nf");
        const state = new EditorViewState(doc, [createSelection(2, 0, 5, 0)]);
        state.setFoldingRegions([createFoldingRegion(1, 3, false)]);

        state.type("Z");

        expect(state.foldedRegions).toHaveLength(0);
    });

    it("shifts a region down when an edit before it inserts lines", () => {
        const doc = new TextDocument("a\nb\nc\nd\ne");
        const state = new EditorViewState(doc, [createCursorSelection(0, 0)]);
        state.setFoldingRegions([createFoldingRegion(2, 4, false)]);

        // Insert a newline at the very top → everything below shifts by one line.
        state.type("\n");

        expect(state.foldedRegions[0]).toMatchObject({ startLine: 3, endLine: 5 });
    });

    it("removes a region when an edit starts inside it and extends past its end", () => {
        // Region (1,3). Replace a selection that begins on line 2 (inside the
        // region) and ends on line 4 (beyond endLine 3) → region is dropped.
        const doc = new TextDocument("a\nb\nc\nd\ne\nf");
        const state = new EditorViewState(doc, [createSelection(2, 0, 4, 1)]);
        state.setFoldingRegions([createFoldingRegion(1, 3, false)]);

        state.type("Q");

        expect(state.foldedRegions).toHaveLength(0);
    });
});

// ─── cursorLeft wrapping across a collapsed fold header ─────

describe("EditorViewState.cursorLeft — wrap to previous visible line", () => {
    it("wraps from line start to the end of the fold header line, skipping hidden lines", () => {
        // Region (0,2) collapsed hides lines 1,2; line 0 is the visible header.
        // From line 3 char 0, cursorLeft must land at the end of line 0.
        const doc = new TextDocument("header\nx\ny\ntail");
        const state = new EditorViewState(doc, [createCursorSelection(3, 0)]);
        state.setFoldingRegions([createFoldingRegion(0, 2, true)]);

        state.cursorLeft();

        expect(state.selections[0].active).toEqual({ line: 0, character: 6 });
    });
});

// ─── deleteRight over a multi-code-unit grapheme ───────────

describe("EditorViewState.deleteRight — wide grapheme", () => {
    it("deletes a whole surrogate-pair emoji as one grapheme", () => {
        // "😀" is two UTF-16 code units but one grapheme slot; deleteRight at
        // offset 0 must remove the entire grapheme, not half of it.
        const doc = new TextDocument("😀ab");
        const state = new EditorViewState(doc, [createCursorSelection(0, 0)]);

        state.deleteRight();

        expect(doc.getText()).toBe("ab");
    });
});
