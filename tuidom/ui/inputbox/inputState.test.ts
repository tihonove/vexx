import { describe, expect, it } from "vitest";

import { InputState } from "./inputState.ts";

// Basic editing + grapheme-aware (wide/unicode) edge cases that exercise the
// slot-matching branches in deleteLeft / deleteRight / moveCursorLeftRaw /
// moveCursorRightRaw. These complement the Selection and WordNavigation suites.

describe("InputState — value / cursor basics", () => {
    it("starts empty with cursor at 0", () => {
        const s = new InputState();
        expect(s.value).toBe("");
        expect(s.text).toBe("");
        expect(s.cursorOffset).toBe(0);
        expect(s.hasSelection).toBe(false);
    });

    it("value setter places cursor at end and clears selection", () => {
        const s = new InputState();
        s.selectAll(); // anchor=0, cursor=0 → no selection yet
        s.value = "hello";
        expect(s.value).toBe("hello");
        expect(s.cursorOffset).toBe(5);
        expect(s.hasSelection).toBe(false);
    });
});

describe("InputState — insert", () => {
    it("inserts at cursor position", () => {
        const s = new InputState();
        s.value = "ac";
        s.moveCursorToStart();
        s.moveCursorRight(); // cursor between a and c
        s.insert("b");
        expect(s.value).toBe("abc");
        expect(s.cursorOffset).toBe(2);
    });

    it("inserts multi-char string and advances cursor by its length", () => {
        const s = new InputState();
        s.value = "xy";
        s.moveCursorToStart();
        s.insert("AB");
        expect(s.value).toBe("ABxy");
        expect(s.cursorOffset).toBe(2);
    });
});

describe("InputState — deleteLeft (Backspace)", () => {
    it("deletes the char to the left", () => {
        const s = new InputState();
        s.value = "abc";
        s.deleteLeft();
        expect(s.value).toBe("ab");
        expect(s.cursorOffset).toBe(2);
    });

    it("does nothing at offset 0", () => {
        const s = new InputState();
        s.value = "abc";
        s.moveCursorToStart();
        s.deleteLeft();
        expect(s.value).toBe("abc");
        expect(s.cursorOffset).toBe(0);
    });

    it("deletes a whole multi-code-unit emoji grapheme as one unit", () => {
        const s = new InputState();
        s.value = "a😀b"; // "😀" is a surrogate pair (length 2)
        s.moveCursorToStart();
        s.moveCursorRight(); // after "a" (offset 1)
        s.moveCursorRight(); // after "😀" (offset 3) — grapheme aware
        expect(s.cursorOffset).toBe(3);
        s.deleteLeft();
        expect(s.value).toBe("ab");
        expect(s.cursorOffset).toBe(1);
    });

    it("deletes a ZWJ family emoji cluster as a single grapheme", () => {
        const family = "👨‍👩‍👧"; // single grapheme, length 8
        const s = new InputState();
        s.value = "x" + family;
        expect(s.cursorOffset).toBe(1 + family.length);
        s.deleteLeft();
        expect(s.value).toBe("x");
        expect(s.cursorOffset).toBe(1);
    });
});

describe("InputState — deleteRight (Delete)", () => {
    it("deletes the char to the right", () => {
        const s = new InputState();
        s.value = "abc";
        s.moveCursorToStart();
        s.deleteRight();
        expect(s.value).toBe("bc");
        expect(s.cursorOffset).toBe(0);
    });

    it("does nothing at end of text", () => {
        const s = new InputState();
        s.value = "abc";
        s.deleteRight();
        expect(s.value).toBe("abc");
        expect(s.cursorOffset).toBe(3);
    });

    it("deletes a whole emoji grapheme to the right as one unit", () => {
        const s = new InputState();
        s.value = "a😀b";
        s.moveCursorToStart();
        s.moveCursorRight(); // after "a" (offset 1), before the emoji
        expect(s.cursorOffset).toBe(1);
        s.deleteRight();
        expect(s.value).toBe("ab");
        expect(s.cursorOffset).toBe(1);
    });
});

describe("InputState — mid-grapheme fallback (cursor inside a surrogate pair)", () => {
    // A cursor can land strictly inside a multi-code-unit grapheme when a high
    // surrogate is inserted in front of a pre-existing lone low surrogate: the two
    // combine into a single emoji grapheme (offset 0, length 2) but the cursor sits
    // at offset 1 — between the two code units. No grapheme slot starts or ends at
    // offset 1, so the slot-scanning loops fall through to the code-unit fallback.

    function midGrapheme(): InputState {
        const s = new InputState();
        s.value = "\uDE00"; // lone low surrogate, cursor at end (offset 1)
        s.moveCursorToStart(); // cursor at offset 0
        s.insert("\uD83D"); // prepend high surrogate -> "😀", cursor advances to offset 1
        expect(s.value).toBe("😀");
        expect(s.value.length).toBe(2);
        expect(s.cursorOffset).toBe(1);
        return s;
    }

    it("deleteLeft falls back to deleting one code unit when no slot ends at the cursor", () => {
        const s = midGrapheme();
        s.deleteLeft();
        // The high surrogate (one code unit to the left) is removed, leaving the low surrogate.
        expect(s.value).toBe("\uDE00");
        expect(s.cursorOffset).toBe(0);
    });

    it("deleteRight falls back to deleting one code unit when no slot starts at the cursor", () => {
        const s = midGrapheme();
        s.deleteRight();
        // The low surrogate (one code unit to the right) is removed, leaving the high surrogate.
        expect(s.value).toBe("\uD83D");
        expect(s.cursorOffset).toBe(1);
    });

    it("moveCursorLeft falls back to stepping one code unit left when mid-grapheme", () => {
        const s = midGrapheme();
        s.moveCursorLeft();
        expect(s.cursorOffset).toBe(0);
        expect(s.value).toBe("😀");
    });

    it("moveCursorRight falls back to stepping one code unit right when mid-grapheme", () => {
        const s = midGrapheme();
        s.moveCursorRight();
        expect(s.cursorOffset).toBe(2);
        expect(s.value).toBe("😀");
    });
});

describe("InputState — grapheme-aware cursor movement", () => {
    it("moveCursorRight steps over a wide emoji as a single grapheme", () => {
        const s = new InputState();
        s.value = "😀x";
        s.moveCursorToStart();
        s.moveCursorRight();
        // Skips the full 2-code-unit surrogate pair, landing on offset 2.
        expect(s.cursorOffset).toBe(2);
    });

    it("moveCursorLeft steps back over a wide emoji as a single grapheme", () => {
        const s = new InputState();
        s.value = "😀x";
        // cursor at end (offset 3)
        s.moveCursorLeft(); // over "x" → offset 2
        expect(s.cursorOffset).toBe(2);
        s.moveCursorLeft(); // over "😀" → offset 0
        expect(s.cursorOffset).toBe(0);
    });

    it("moveCursorLeft does nothing at offset 0", () => {
        const s = new InputState();
        s.value = "ab";
        s.moveCursorToStart();
        s.moveCursorLeft();
        expect(s.cursorOffset).toBe(0);
    });

    it("moveCursorRight does nothing at end", () => {
        const s = new InputState();
        s.value = "ab";
        s.moveCursorRight();
        expect(s.cursorOffset).toBe(2);
    });
});
