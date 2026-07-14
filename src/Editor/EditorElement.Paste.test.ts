import { describe, expect, it } from "vitest";

import { Size } from "../vs/base/common/geometry.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIPasteEvent } from "../vs/base/tui/events/tuiPasteEvent.ts";

import { EditorElement } from "./EditorElement.ts";
import { EditorViewState } from "./EditorViewState.ts";
import { createCursorSelection } from "./ISelection.ts";
import { TextDocument } from "./TextDocument.ts";

function createEditor(text: string): { app: TestApp; editor: EditorElement } {
    const doc = new TextDocument(text);
    const viewState = new EditorViewState(doc);
    const editor = new EditorElement(viewState);
    const app = TestApp.createWithContent(editor, new Size(40, 6));
    editor.focus();
    return { app, editor };
}

describe("EditorElement — bracketed paste", () => {
    it("inserts a multi-line paste at the cursor in one edit", () => {
        const { editor } = createEditor("ab");
        editor.viewState.selections = [createCursorSelection(0, 1)]; // between a and b

        editor.dispatchEvent(new TUIPasteEvent("X\nY"));

        expect(editor.viewState.document.getText()).toBe("aX\nYb");
    });

    it("a pasted block is a single undo step", () => {
        const { editor } = createEditor("");
        editor.viewState.selections = [createCursorSelection(0, 0)];

        editor.dispatchEvent(new TUIPasteEvent("one\ntwo\nthree"));
        expect(editor.viewState.document.getText()).toBe("one\ntwo\nthree");

        editor.undoManager.undo();
        expect(editor.viewState.document.getText()).toBe("");
    });
});
