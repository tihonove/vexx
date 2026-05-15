import { describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { EditorElement } from "./EditorElement.ts";
import { EditorViewState } from "./EditorViewState.ts";
import { createCursorSelection } from "./ISelection.ts";
import { TextDocument } from "./TextDocument.ts";

function createEditor(text: string, width = 30, height = 5): { app: TestApp; editor: EditorElement } {
    const doc = new TextDocument(text);
    const viewState = new EditorViewState(doc);
    const editor = new EditorElement(viewState);
    const app = TestApp.createWithContent(editor, new Size(width, height));
    editor.focus();
    return { app, editor };
}

describe("EditorElement – Tab key", () => {
    it("Tab inserts \\t at the beginning of the document", () => {
        const { app, editor } = createEditor("hello");

        app.sendKey("Tab");

        expect(editor.viewState.document.getText()).toBe("\thello");
    });

    it("Tab inserts \\t at the current cursor position within text", () => {
        const { app, editor } = createEditor("ab");
        editor.viewState.selections = [createCursorSelection(0, 1)];

        app.sendKey("Tab");

        expect(editor.viewState.document.getText()).toBe("a\tb");
    });

    it("Tab does not trigger focus cycling", () => {
        const { app, editor: _ } = createEditor("hello");

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const cycleFocusSpy = vi.spyOn(app.app.focusManager!, "cycleFocus");

        app.sendKey("Tab");

        expect(cycleFocusSpy).not.toHaveBeenCalled();
    });

    it("Tab keeps focus on the editor", () => {
        const { app, editor } = createEditor("hello");

        app.sendKey("Tab");

        expect(app.focusedElement).toBe(editor);
    });
});

describe("EditorElement – Ctrl+Tab key", () => {
    it("Ctrl+Tab does not insert any character", () => {
        const { app, editor } = createEditor("hello");

        app.sendKey("Ctrl+Tab");

        expect(editor.viewState.document.getText()).toBe("hello");
    });
});

describe("EditorElement – Shift+Tab key", () => {
    it("Shift+Tab does not insert any character", () => {
        const { app, editor } = createEditor("hello");

        app.sendKey("Shift+Tab");

        expect(editor.viewState.document.getText()).toBe("hello");
    });

    it("Shift+Tab does not trigger focus cycling", () => {
        const { app, editor: _ } = createEditor("hello");

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const cycleFocusSpy = vi.spyOn(app.app.focusManager!, "cycleFocus");

        app.sendKey("Shift+Tab");

        expect(cycleFocusSpy).not.toHaveBeenCalled();
    });

    it("Shift+Tab keeps focus on the editor", () => {
        const { app, editor } = createEditor("hello");

        app.sendKey("Shift+Tab");

        expect(app.focusedElement).toBe(editor);
    });
});
