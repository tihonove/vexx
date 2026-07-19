import { describe, expect, it } from "vitest";

import { InputState } from "./inputState.ts";

describe("InputState — selection boundaries without an active selection", () => {
    // With no anchor set, selectionStart/selectionEnd both collapse to the caret
    // (the `anchorOffset === null` early returns on lines 38 and 42-43).
    it("selectionStart equals the cursor offset when nothing is selected", () => {
        const s = new InputState();
        s.value = "abc"; // caret at end (offset 3), no anchor
        expect(s.hasSelection).toBe(false);
        expect(s.selectionStart).toBe(3);
    });

    it("selectionEnd equals the cursor offset when nothing is selected", () => {
        const s = new InputState();
        s.value = "abc";
        s.moveCursorToStart(); // caret at 0, still no anchor
        expect(s.hasSelection).toBe(false);
        expect(s.selectionEnd).toBe(0);
    });

    it("collapsing a selection makes start and end meet at the caret again", () => {
        const s = new InputState();
        s.value = "abc";
        s.selectLeft(); // anchor=3, caret=2 → real selection
        expect(s.hasSelection).toBe(true);
        s.clearSelection(); // drop the anchor
        expect(s.selectionStart).toBe(2);
        expect(s.selectionEnd).toBe(2);
    });
});

describe("InputState — selection", () => {
    // ─── selectLeft / selectRight ────────────────────────────────────────────

    describe("selectLeft", () => {
        it("sets anchor at current cursor and moves cursor left", () => {
            const s = new InputState();
            s.value = "hello";
            s.selectLeft();
            expect(s.hasSelection).toBe(true);
            expect(s.selectionStart).toBe(4);
            expect(s.selectionEnd).toBe(5);
            expect(s.selectedText).toBe("o");
        });

        it("extends selection further left on second call", () => {
            const s = new InputState();
            s.value = "abc";
            s.selectLeft();
            s.selectLeft();
            expect(s.selectedText).toBe("bc");
        });

        it("does nothing at position 0", () => {
            const s = new InputState();
            s.value = "hi";
            s.moveCursorToStart();
            s.selectLeft();
            expect(s.hasSelection).toBe(false);
        });
    });

    describe("selectRight", () => {
        it("sets anchor at current cursor and moves cursor right", () => {
            const s = new InputState();
            s.value = "hello";
            s.moveCursorToStart();
            s.selectRight();
            expect(s.hasSelection).toBe(true);
            expect(s.selectedText).toBe("h");
        });

        it("does nothing at end", () => {
            const s = new InputState();
            s.value = "hi";
            s.selectRight();
            expect(s.hasSelection).toBe(false);
        });
    });

    // ─── selectToStart / selectToEnd ─────────────────────────────────────────

    describe("selectToStart", () => {
        it("selects from cursor to beginning", () => {
            const s = new InputState();
            s.value = "hello world";
            s.moveCursorWordLeft(); // "world"
            s.selectToStart();
            expect(s.selectedText).toBe("hello ");
        });
    });

    describe("selectToEnd", () => {
        it("selects from cursor to end", () => {
            const s = new InputState();
            s.value = "hello world";
            s.moveCursorToStart();
            s.selectToEnd();
            expect(s.selectedText).toBe("hello world");
        });
    });

    // ─── selectAll ───────────────────────────────────────────────────────────

    describe("selectAll", () => {
        it("selects entire text", () => {
            const s = new InputState();
            s.value = "abc def";
            s.selectAll();
            expect(s.selectedText).toBe("abc def");
            expect(s.selectionStart).toBe(0);
            expect(s.selectionEnd).toBe(7);
        });
    });

    // ─── selectWordLeft / selectWordRight ────────────────────────────────────

    describe("selectWordLeft", () => {
        it("selects previous word", () => {
            const s = new InputState();
            s.value = "foo bar";
            s.selectWordLeft();
            expect(s.selectedText).toBe("bar");
        });
    });

    describe("selectWordRight", () => {
        it("selects next word", () => {
            const s = new InputState();
            s.value = "foo bar";
            s.moveCursorToStart();
            s.selectWordRight();
            expect(s.selectedText).toBe("foo");
        });
    });

    // ─── insert replaces selection ───────────────────────────────────────────

    describe("insert with selection", () => {
        it("replaces selected text with typed char", () => {
            const s = new InputState();
            s.value = "hello world";
            s.selectAll();
            s.insert("x");
            expect(s.value).toBe("x");
            expect(s.hasSelection).toBe(false);
        });

        it("replaces partial selection", () => {
            const s = new InputState();
            s.value = "hello";
            s.moveCursorToStart();
            s.selectRight();
            s.selectRight();
            s.insert("HE");
            expect(s.value).toBe("HEllo");
        });
    });

    // ─── deleteLeft / deleteRight / deleteWordLeft / deleteWordRight ─────────

    describe("deleteLeft with selection", () => {
        it("deletes selection instead of single char", () => {
            const s = new InputState();
            s.value = "hello";
            s.selectAll();
            s.deleteLeft();
            expect(s.value).toBe("");
            expect(s.hasSelection).toBe(false);
        });
    });

    describe("deleteRight with selection", () => {
        it("deletes selection", () => {
            const s = new InputState();
            s.value = "abc";
            s.moveCursorToStart();
            s.selectRight();
            s.deleteRight();
            expect(s.value).toBe("bc");
        });
    });

    describe("deleteWordLeft with selection", () => {
        it("deletes selection instead of word", () => {
            const s = new InputState();
            s.value = "hello world";
            s.moveCursorToStart();
            s.selectToEnd();
            s.deleteWordLeft();
            expect(s.value).toBe("");
        });
    });

    describe("deleteWordRight with selection", () => {
        it("deletes selection", () => {
            const s = new InputState();
            s.value = "foo bar";
            s.moveCursorToStart();
            s.selectRight();
            s.selectRight();
            s.deleteWordRight();
            expect(s.value).toBe("o bar");
        });
    });

    // ─── moveCursor clears selection ─────────────────────────────────────────

    describe("moveCursorLeft clears selection", () => {
        it("collapses to selectionStart when selection exists", () => {
            const s = new InputState();
            s.value = "hello";
            s.selectAll(); // cursor=5, anchor=0
            s.moveCursorLeft();
            expect(s.hasSelection).toBe(false);
            expect(s.cursorOffset).toBe(0);
        });
    });

    describe("moveCursorRight clears selection", () => {
        it("collapses to selectionEnd when selection exists", () => {
            const s = new InputState();
            s.value = "hello";
            s.moveCursorToStart();
            s.selectAll(); // anchor=0, cursor=5
            s.moveCursorRight();
            expect(s.hasSelection).toBe(false);
            expect(s.cursorOffset).toBe(5);
        });
    });

    describe("moveCursorToStart / moveCursorToEnd clears selection", () => {
        it("moveCursorToStart clears selection", () => {
            const s = new InputState();
            s.value = "hello";
            s.selectAll();
            s.moveCursorToStart();
            expect(s.hasSelection).toBe(false);
            expect(s.cursorOffset).toBe(0);
        });

        it("moveCursorToEnd clears selection", () => {
            const s = new InputState();
            s.value = "hello";
            s.moveCursorToStart();
            s.selectAll();
            s.moveCursorToEnd();
            expect(s.hasSelection).toBe(false);
            expect(s.cursorOffset).toBe(5);
        });
    });

    describe("moveCursorWordLeft / moveCursorWordRight clears selection", () => {
        it("moveCursorWordLeft clears selection", () => {
            const s = new InputState();
            s.value = "foo bar";
            s.selectAll();
            s.moveCursorWordLeft();
            expect(s.hasSelection).toBe(false);
        });
    });

    // ─── clearSelection ──────────────────────────────────────────────────────

    describe("clearSelection", () => {
        it("removes selection without moving cursor", () => {
            const s = new InputState();
            s.value = "hello";
            s.selectAll();
            expect(s.hasSelection).toBe(true);
            s.clearSelection();
            expect(s.hasSelection).toBe(false);
            expect(s.cursorOffset).toBe(5);
        });
    });
});
