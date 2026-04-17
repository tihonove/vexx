import { describe, expect, it } from "vitest";

import { EditorViewState } from "./EditorViewState.ts";
import { createCursorSelection, createSelection, isSelectionCollapsed } from "./ISelection.ts";
import { TextDocument } from "./TextDocument.ts";

describe("EditorViewState.selectAll", () => {
    it("selects entire single-line document", () => {
        const doc = new TextDocument("hello");
        const state = new EditorViewState(doc, [createCursorSelection(0, 2)]);
        state.selectAll();
        expect(state.selections).toHaveLength(1);
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 0 });
        expect(state.selections[0].active).toEqual({ line: 0, character: 5 });
    });

    it("selects entire multi-line document", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const state = new EditorViewState(doc, [createCursorSelection(1, 1)]);
        state.selectAll();
        expect(state.selections).toHaveLength(1);
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 0 });
        expect(state.selections[0].active).toEqual({ line: 2, character: 3 });
    });

    it("replaces existing selection", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const state = new EditorViewState(doc, [createSelection(0, 1, 0, 3)]);
        state.selectAll();
        expect(state.selections).toHaveLength(1);
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 0 });
        expect(state.selections[0].active).toEqual({ line: 2, character: 3 });
    });

    it("replaces multi-cursor with single selection", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const state = new EditorViewState(doc, [createCursorSelection(0, 0), createCursorSelection(2, 0)]);
        state.selectAll();
        expect(state.selections).toHaveLength(1);
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 0 });
        expect(state.selections[0].active).toEqual({ line: 2, character: 3 });
    });

    it("creates non-collapsed selection", () => {
        const doc = new TextDocument("hello");
        const state = new EditorViewState(doc);
        state.selectAll();
        expect(isSelectionCollapsed(state.selections[0])).toBe(false);
    });

    it("handles empty document", () => {
        const doc = new TextDocument("");
        const state = new EditorViewState(doc);
        state.selectAll();
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 0 });
        expect(state.selections[0].active).toEqual({ line: 0, character: 0 });
    });

    it("handles document with trailing newline", () => {
        const doc = new TextDocument("hello\n");
        const state = new EditorViewState(doc);
        state.selectAll();
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 0 });
        expect(state.selections[0].active).toEqual({ line: 1, character: 0 });
    });
});
