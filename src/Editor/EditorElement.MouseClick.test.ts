import { describe, expect, it } from "vitest";

import { Size } from "../vs/base/common/geometry.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIMouseEvent } from "../vs/base/tui/events/tuiMouseEvent.ts";

import { EditorElement } from "./EditorElement.ts";
import { EditorViewState } from "./EditorViewState.ts";
import { TextDocument } from "./TextDocument.ts";

function createEditor(text: string, width = 30, height = 5): { app: TestApp; editor: EditorElement } {
    const doc = new TextDocument(text);
    const viewState = new EditorViewState(doc);
    const editor = new EditorElement(viewState);
    const app = TestApp.createWithContent(editor, new Size(width, height));
    return { app, editor };
}

function fireMouseDown(editor: EditorElement, localX: number, localY: number, shiftKey = false): void {
    editor.dispatchEvent(
        new TUIMouseEvent("mousedown", {
            button: "left",
            screenX: localX,
            screenY: localY,
            localX,
            localY,
            shiftKey,
        }),
    );
}

describe("EditorElement – mouse click cursor placement", () => {
    it("click in content area places cursor at correct line and character", () => {
        const { editor } = createEditor("hello\nworld\nfoo", 30, 5);
        const gw = editor.gutterWidth;

        // Click on row 1 (second line), after "wo" (2 chars into content)
        fireMouseDown(editor, gw + 2, 1);

        const sel = editor.viewState.selections[0];
        expect(sel.active.line).toBe(1);
        expect(sel.active.character).toBe(2);
    });

    it("click at start of line places cursor at character 0", () => {
        const { editor } = createEditor("hello\nworld", 30, 5);
        const gw = editor.gutterWidth;

        fireMouseDown(editor, gw + 0, 0);

        const sel = editor.viewState.selections[0];
        expect(sel.active.line).toBe(0);
        expect(sel.active.character).toBe(0);
    });

    it("click in gutter places cursor at beginning of that line", () => {
        const { editor } = createEditor("hello\nworld", 30, 5);

        // Click in gutter (x=0)
        fireMouseDown(editor, 0, 1);

        const sel = editor.viewState.selections[0];
        expect(sel.active.line).toBe(1);
        expect(sel.active.character).toBe(0);
    });

    it("click past end of line places cursor at end of line", () => {
        const { editor } = createEditor("hi\nworld", 30, 5);
        const gw = editor.gutterWidth;

        // "hi" is 2 chars; click at column 100 far past end
        fireMouseDown(editor, gw + 100, 0);

        const sel = editor.viewState.selections[0];
        expect(sel.active.line).toBe(0);
        expect(sel.active.character).toBe(2); // end of "hi"
    });

    it("click past last line places cursor on last line", () => {
        const { editor } = createEditor("hello\nworld", 30, 3);
        const gw = editor.gutterWidth;

        // Click on row 10, far beyond document (only 2 lines)
        fireMouseDown(editor, gw + 0, 10);

        const sel = editor.viewState.selections[0];
        expect(sel.active.line).toBe(1); // last line
    });

    it("shift+click extends selection from existing anchor", () => {
        const { editor } = createEditor("hello\nworld\nfoo", 30, 5);
        const gw = editor.gutterWidth;

        // Place cursor at line 0, char 0
        fireMouseDown(editor, gw + 0, 0);
        // Shift-click at line 1, char 3
        fireMouseDown(editor, gw + 3, 1, true);

        const sel = editor.viewState.selections[0];
        expect(sel.anchor.line).toBe(0);
        expect(sel.anchor.character).toBe(0);
        expect(sel.active.line).toBe(1);
        expect(sel.active.character).toBe(3);
    });

    it("click with scrollTop > 0 accounts for scroll offset (correct logical line)", () => {
        const { editor } = createEditor("line0\nline1\nline2\nline3\nline4", 30, 3);
        const gw = editor.gutterWidth;

        // Manually scroll down by 2 lines
        editor.viewState.scrollTop = 2;

        // Click on screen row 0 now corresponds to logical line 2
        fireMouseDown(editor, gw + 0, 0);

        const sel = editor.viewState.selections[0];
        expect(sel.active.line).toBe(2);
    });

    it("click with scrollLeft > 0 accounts for horizontal scroll offset", () => {
        const { editor } = createEditor("abcdefghij", 15, 3);
        const gw = editor.gutterWidth;

        // Scroll right by 5 columns
        editor.viewState.scrollLeft = 5;

        // Click at screen column 0 in content area → display column 5 → char offset 5
        fireMouseDown(editor, gw + 0, 0);

        const sel = editor.viewState.selections[0];
        expect(sel.active.line).toBe(0);
        expect(sel.active.character).toBe(5);
    });
});
