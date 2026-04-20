import { describe, expect, it } from "vitest";

import { EditorViewState } from "./EditorViewState.ts";
import { createCursorSelection } from "./ISelection.ts";
import { TextDocument } from "./TextDocument.ts";

function createState(text: string, line = 0, character = 0): EditorViewState {
    const doc = new TextDocument(text);
    const state = new EditorViewState(doc, [createCursorSelection(line, character)]);
    return state;
}

// ─── cursorRight through multi-codeunit characters ──────────

describe("cursorRight — grapheme navigation", () => {
    it("skips entire emoji (surrogate pair)", () => {
        // "a😀b" — emoji at offsets 1-2, "b" at offset 3
        const state = createState("a😀b", 0, 1);
        state.cursorRight();
        expect(state.selections[0].active.character).toBe(3); // past entire emoji
    });

    it("skips entire CJK character (single code unit)", () => {
        // "a漢b" — 漢 at offset 1, "b" at offset 2
        const state = createState("a漢b", 0, 1);
        state.cursorRight();
        expect(state.selections[0].active.character).toBe(2);
    });

    it("skips tab as single grapheme", () => {
        const state = createState("a\tb", 0, 1);
        state.cursorRight();
        expect(state.selections[0].active.character).toBe(2); // past the tab
    });

    it("wraps to next line at end of line (no regression)", () => {
        const state = createState("abc\nxyz", 0, 3);
        state.cursorRight();
        expect(state.selections[0].active.line).toBe(1);
        expect(state.selections[0].active.character).toBe(0);
    });

    it("skips ZWJ emoji sequence as single grapheme", () => {
        // 👨‍👩‍👧 is a ZWJ sequence
        const emoji = "👨\u200D👩\u200D👧";
        const text = "a" + emoji + "b";
        const state = createState(text, 0, 1);
        state.cursorRight();
        // After the emoji, cursor should be at the offset of "b"
        expect(state.selections[0].active.character).toBe(1 + emoji.length);
    });
});

// ─── cursorLeft through multi-codeunit characters ───────────

describe("cursorLeft — grapheme navigation", () => {
    it("skips entire emoji (surrogate pair) going left", () => {
        // "a😀b" — cursor at offset 3 ("b"), move left → offset 1 (start of emoji)
        const state = createState("a😀b", 0, 3);
        state.cursorLeft();
        expect(state.selections[0].active.character).toBe(1);
    });

    it("skips CJK character going left", () => {
        const state = createState("a漢b", 0, 2);
        state.cursorLeft();
        expect(state.selections[0].active.character).toBe(1);
    });

    it("wraps to previous line at start (no regression)", () => {
        const state = createState("abc\nxyz", 1, 0);
        state.cursorLeft();
        expect(state.selections[0].active.line).toBe(0);
        expect(state.selections[0].active.character).toBe(3);
    });

    it("moves to last grapheme from end of line with emoji", () => {
        // "a😀" — cursor at offset 3 (end of line, past emoji)
        const state = createState("a😀", 0, 3);
        state.cursorLeft();
        expect(state.selections[0].active.character).toBe(1); // start of emoji
    });
});

// ─── idealColumn as display column ──────────────────────────

describe("idealColumn — display column semantics", () => {
    it("cursorDown preserves display column through line with tab", () => {
        // line 0: "abcdef"     (display cols: 0-5)
        // line 1: "\tx"        (display: tab=4cols, x at col 4; offsets: \t=0, x=1)
        // line 2: "xyzwvuabcd" (display cols: 0-9)
        const state = createState("abcdef\n\tx\nxyzwvuabcd", 0, 5); // cursor at 'f', display col 5
        state.cursorDown(); // → line 1
        // Display col 5 → on line "\tx": tab occupies cols 0-3, "x" at col 4
        // Col 5 is past "x", so cursor goes to end = offset 2
        expect(state.selections[0].active.line).toBe(1);
        expect(state.selections[0].active.character).toBe(2);

        state.cursorDown(); // → line 2
        // idealColumn preserved as 5 → offset 5
        expect(state.selections[0].active.line).toBe(2);
        expect(state.selections[0].active.character).toBe(5);
    });

    it("cursorDown preserves display column through line with CJK", () => {
        // line 0: "abcdef"    (display cols: 0-5)
        // line 1: "漢字xyz"   (display: 漢=0-1, 字=2-3, x=4, y=5, z=6)
        // line 2: "0123456789"
        const state = createState("abcdef\n漢字xyz\n0123456789", 0, 3); // cursor at 'd', display col 3
        state.cursorDown(); // → line 1
        // Display col 3 → on line "漢字xyz": col 3 is second column of 字 → offset of 字 = 1
        expect(state.selections[0].active.line).toBe(1);
        expect(state.selections[0].active.character).toBe(1); // offset of 字

        state.cursorDown(); // → line 2
        // idealColumn preserved as 3 → offset 3
        expect(state.selections[0].active.line).toBe(2);
        expect(state.selections[0].active.character).toBe(3);
    });
});

// ─── ensureCursorVisible — horizontal scroll ────────────────

describe("ensureCursorVisible — display column scrolling", () => {
    it("scrollLeft adjusts based on display column with tabs", () => {
        // Line: "\t\tx" — display: 8 spaces then x at col 8
        const state = createState("\t\tx");
        state.tabSize = 4;
        state.viewportWidth = 5;
        state.viewportHeight = 10;
        // Move cursor to "x" (offset 2, display col 8)
        state.selections = [createCursorSelection(0, 2)];
        // Trigger ensureCursorVisible by calling a movement
        state.cursorRight(); // moves to offset 3 (end), triggers ensureCursorVisible
        // Cursor at end of "x" = offset 3, display col 9
        // Since col 9 >= scrollLeft + viewportWidth (0 + 5), scrollLeft should adjust
        expect(state.scrollLeft).toBeGreaterThan(0);
    });
});

// ─── deleteLeft — grapheme-aware ────────────────────────────

describe("deleteLeft — grapheme-aware deletion", () => {
    it("deletes entire emoji with single backspace", () => {
        // "a😀b" — cursor at offset 3 ("b"), backspace should delete "😀" (2 code units)
        const state = createState("a😀b", 0, 3);
        state.deleteLeft();
        expect(state.document.getLineContent(0)).toBe("ab");
        expect(state.selections[0].active.character).toBe(1);
    });

    it("deletes entire CJK character with single backspace", () => {
        const state = createState("a漢b", 0, 2);
        state.deleteLeft();
        expect(state.document.getLineContent(0)).toBe("ab");
        expect(state.selections[0].active.character).toBe(1);
    });

    it("deletes tab with single backspace", () => {
        const state = createState("\tx", 0, 1);
        state.deleteLeft();
        expect(state.document.getLineContent(0)).toBe("x");
        expect(state.selections[0].active.character).toBe(0);
    });
});

// ─── deleteRight — grapheme-aware ───────────────────────────

describe("deleteRight — grapheme-aware deletion", () => {
    it("deletes entire emoji with single delete key", () => {
        // "a😀b" — cursor at offset 1 (start of emoji), delete should remove "😀"
        const state = createState("a😀b", 0, 1);
        state.deleteRight();
        expect(state.document.getLineContent(0)).toBe("ab");
        expect(state.selections[0].active.character).toBe(1);
    });

    it("deletes entire CJK character with single delete key", () => {
        const state = createState("a漢b", 0, 1);
        state.deleteRight();
        expect(state.document.getLineContent(0)).toBe("ab");
        expect(state.selections[0].active.character).toBe(1);
    });

    it("deletes tab with single delete key", () => {
        const state = createState("a\tb", 0, 1);
        state.deleteRight();
        expect(state.document.getLineContent(0)).toBe("ab");
        expect(state.selections[0].active.character).toBe(1);
    });
});
