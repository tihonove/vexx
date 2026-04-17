import { describe, expect, it } from "vitest";

import { EditorViewState } from "./EditorViewState.ts";
import { createCursorSelection, createSelection } from "./ISelection.ts";
import { TextDocument } from "./TextDocument.ts";

describe("EditorViewState.cursorTop", () => {
    it("moves cursor to the beginning of the document", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const state = new EditorViewState(doc, [createCursorSelection(2, 2)]);
        state.cursorTop();
        expect(state.selections[0].active).toEqual({ line: 0, character: 0 });
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 0 });
    });

    it("stays at 0,0 when already there", () => {
        const doc = new TextDocument("aaa\nbbb");
        const state = new EditorViewState(doc, [createCursorSelection(0, 0)]);
        state.cursorTop();
        expect(state.selections[0].active).toEqual({ line: 0, character: 0 });
    });

    it("with selection mode creates selection from current position to document start", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const state = new EditorViewState(doc, [createCursorSelection(2, 2)]);
        state.cursorTop(true);
        expect(state.selections[0].anchor).toEqual({ line: 2, character: 2 });
        expect(state.selections[0].active).toEqual({ line: 0, character: 0 });
    });

    it("with selection mode extends existing selection", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const state = new EditorViewState(doc, [createSelection(1, 1, 2, 2)]);
        state.cursorTop(true);
        expect(state.selections[0].anchor).toEqual({ line: 1, character: 1 });
        expect(state.selections[0].active).toEqual({ line: 0, character: 0 });
    });

    it("works with single-line document", () => {
        const doc = new TextDocument("hello");
        const state = new EditorViewState(doc, [createCursorSelection(0, 3)]);
        state.cursorTop();
        expect(state.selections[0].active).toEqual({ line: 0, character: 0 });
    });
});

describe("EditorViewState.cursorBottom", () => {
    it("moves cursor to the end of the document", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const state = new EditorViewState(doc, [createCursorSelection(0, 0)]);
        state.cursorBottom();
        expect(state.selections[0].active).toEqual({ line: 2, character: 3 });
        expect(state.selections[0].anchor).toEqual({ line: 2, character: 3 });
    });

    it("stays at end when already there", () => {
        const doc = new TextDocument("aaa\nbbb");
        const state = new EditorViewState(doc, [createCursorSelection(1, 3)]);
        state.cursorBottom();
        expect(state.selections[0].active).toEqual({ line: 1, character: 3 });
    });

    it("with selection mode creates selection from current position to document end", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const state = new EditorViewState(doc, [createCursorSelection(0, 1)]);
        state.cursorBottom(true);
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 1 });
        expect(state.selections[0].active).toEqual({ line: 2, character: 3 });
    });

    it("with selection mode extends existing selection", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const state = new EditorViewState(doc, [createSelection(0, 1, 1, 0)]);
        state.cursorBottom(true);
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 1 });
        expect(state.selections[0].active).toEqual({ line: 2, character: 3 });
    });

    it("works with single-line document", () => {
        const doc = new TextDocument("hello");
        const state = new EditorViewState(doc, [createCursorSelection(0, 0)]);
        state.cursorBottom();
        expect(state.selections[0].active).toEqual({ line: 0, character: 5 });
    });

    it("handles empty last line", () => {
        const doc = new TextDocument("aaa\n");
        const state = new EditorViewState(doc, [createCursorSelection(0, 0)]);
        state.cursorBottom();
        expect(state.selections[0].active).toEqual({ line: 1, character: 0 });
    });
});
