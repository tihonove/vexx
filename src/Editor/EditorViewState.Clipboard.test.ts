import { describe, expect, it } from "vitest";

import { EditorViewState } from "./EditorViewState.ts";
import { createCursorSelection, createSelection } from "./ISelection.ts";
import { TextDocument } from "./TextDocument.ts";

describe("EditorViewState.getSelectedText", () => {
    it("returns empty string when selection is collapsed", () => {
        const doc = new TextDocument("hello world");
        const state = new EditorViewState(doc, [createCursorSelection(0, 5)]);
        expect(state.getSelectedText()).toBe("");
    });

    it("returns selected text within a single line", () => {
        const doc = new TextDocument("hello world");
        const state = new EditorViewState(doc, [createSelection(0, 0, 0, 5)]);
        expect(state.getSelectedText()).toBe("hello");
    });

    it("returns selected text that spans multiple lines", () => {
        const doc = new TextDocument("foo\nbar\nbaz");
        const state = new EditorViewState(doc, [createSelection(0, 1, 2, 2)]);
        expect(state.getSelectedText()).toBe("oo\nbar\nba");
    });

    it("returns selected text when anchor is after active (reverse selection)", () => {
        const doc = new TextDocument("hello world");
        const state = new EditorViewState(doc, [createSelection(0, 5, 0, 0)]);
        expect(state.getSelectedText()).toBe("hello");
    });

    it("returns entire document when all text is selected", () => {
        const doc = new TextDocument("abc\ndef");
        const state = new EditorViewState(doc);
        state.selectAll();
        expect(state.getSelectedText()).toBe("abc\ndef");
    });

    it("returns empty string when selection is at line end (collapsed)", () => {
        const doc = new TextDocument("hello");
        const state = new EditorViewState(doc, [createCursorSelection(0, 5)]);
        expect(state.getSelectedText()).toBe("");
    });
});

describe("EditorViewState.insertText", () => {
    it("inserts text at cursor position", () => {
        const doc = new TextDocument("hello");
        const state = new EditorViewState(doc, [createCursorSelection(0, 5)]);
        state.insertText(" world");
        expect(doc.getText()).toBe("hello world");
    });

    it("inserts text in the middle of a line", () => {
        const doc = new TextDocument("helo");
        const state = new EditorViewState(doc, [createCursorSelection(0, 3)]);
        state.insertText("l");
        expect(doc.getText()).toBe("hello");
    });

    it("replaces selected text with inserted text", () => {
        const doc = new TextDocument("hello world");
        const state = new EditorViewState(doc, [createSelection(0, 6, 0, 11)]);
        state.insertText("there");
        expect(doc.getText()).toBe("hello there");
    });

    it("replaces multi-line selection with inserted text", () => {
        const doc = new TextDocument("foo\nbar\nbaz");
        const state = new EditorViewState(doc, [createSelection(0, 3, 2, 0)]);
        state.insertText(" ");
        expect(doc.getText()).toBe("foo baz");
    });

    it("moves cursor after inserted text", () => {
        const doc = new TextDocument("ab");
        const state = new EditorViewState(doc, [createCursorSelection(0, 1)]);
        state.insertText("XY");
        expect(state.selections[0].active).toEqual({ line: 0, character: 3 });
    });

    it("returns an undo element that can restore previous state", () => {
        const doc = new TextDocument("hello");
        const state = new EditorViewState(doc, [createCursorSelection(0, 5)]);
        const undo = state.insertText(" world");
        expect(undo).toBeDefined();
        expect(undo.label).toBe("type");
        doc.applyEdits(undo.backwardEdits);
        expect(doc.getText()).toBe("hello");
    });
});
