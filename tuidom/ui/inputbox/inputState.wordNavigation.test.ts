import { describe, expect, it } from "vitest";

import { InputState } from "./inputState.ts";

// ─── moveCursorWordLeft ──────────────────────────────────────

describe("InputState.moveCursorWordLeft", () => {
    it("moves to start of current word", () => {
        const s = new InputState();
        s.value = "hello world";
        s.moveCursorLeft(); // pos = 10 ("l" of "world")
        s.moveCursorLeft(); // pos = 9
        s.moveCursorWordLeft();
        expect(s.cursorOffset).toBe(6); // start of "world"
    });

    it("skips whitespace then word chars", () => {
        const s = new InputState();
        s.value = "hello world"; // pos = 11
        // pos is at end: skip non-word (none), skip "world" → 6
        s.moveCursorWordLeft();
        expect(s.cursorOffset).toBe(6);
    });

    it("skips whitespace before word", () => {
        const s = new InputState();
        s.value = "hello world"; // pos = 11
        s.moveCursorWordLeft(); // → 6 (start of "world")
        s.moveCursorWordLeft(); // skip non-word (space at 5) → 5, then skip "hello" → 0
        expect(s.cursorOffset).toBe(0);
    });

    it("stays at start", () => {
        const s = new InputState();
        s.value = "hello";
        s.moveCursorToStart();
        s.moveCursorWordLeft();
        expect(s.cursorOffset).toBe(0);
    });

    it("handles multiple spaces", () => {
        const s = new InputState();
        s.value = "foo   bar"; // pos = 9
        s.moveCursorWordLeft(); // skip non-word (none), skip "bar" → 6
        expect(s.cursorOffset).toBe(6);
        s.moveCursorWordLeft(); // skip spaces (3) → 3, skip "foo" → 0
        expect(s.cursorOffset).toBe(0);
    });

    it("handles cursor in middle of whitespace", () => {
        const s = new InputState();
        s.value = "foo   bar";
        // move to pos=4 (second space)
        s.moveCursorToStart();
        for (let i = 0; i < 4; i++) s.moveCursorRight();
        expect(s.cursorOffset).toBe(4);
        s.moveCursorWordLeft(); // skip space at pos=3, then skip "foo" → 0
        expect(s.cursorOffset).toBe(0);
    });
});

// ─── moveCursorWordRight ─────────────────────────────────────

describe("InputState.moveCursorWordRight", () => {
    it("moves to end of current word from start", () => {
        const s = new InputState();
        s.value = "hello world";
        s.moveCursorToStart();
        s.moveCursorWordRight();
        expect(s.cursorOffset).toBe(5); // end of "hello"
    });

    it("skips whitespace then moves to end of next word", () => {
        const s = new InputState();
        s.value = "hello world";
        s.moveCursorToStart();
        s.moveCursorWordRight(); // → 5 (end of "hello")
        s.moveCursorWordRight(); // skip space → 6, skip "world" → 11
        expect(s.cursorOffset).toBe(11);
    });

    it("stays at end", () => {
        const s = new InputState();
        s.value = "hello";
        s.moveCursorWordRight();
        expect(s.cursorOffset).toBe(5);
    });

    it("handles multiple spaces", () => {
        const s = new InputState();
        s.value = "foo   bar";
        s.moveCursorToStart();
        s.moveCursorWordRight(); // skip non-word (none), skip "foo" → 3
        expect(s.cursorOffset).toBe(3);
        s.moveCursorWordRight(); // skip spaces → 6, skip "bar" → 9
        expect(s.cursorOffset).toBe(9);
    });

    it("handles cursor already in whitespace", () => {
        const s = new InputState();
        s.value = "foo   bar";
        // move to pos=3 (first space after "foo")
        s.moveCursorToStart();
        for (let i = 0; i < 3; i++) s.moveCursorRight();
        s.moveCursorWordRight(); // skip spaces 3→6, skip "bar" → 9
        expect(s.cursorOffset).toBe(9);
    });
});

// ─── deleteWordLeft ──────────────────────────────────────────

describe("InputState.deleteWordLeft", () => {
    it("deletes current word to the left", () => {
        const s = new InputState();
        s.value = "hello world"; // cursor at end (11)
        s.deleteWordLeft();
        expect(s.text).toBe("hello ");
        expect(s.cursorOffset).toBe(6);
    });

    it("deletes whitespace + word when cursor after whitespace", () => {
        const s = new InputState();
        s.value = "hello world"; // cursor at end (11)
        s.deleteWordLeft(); // delete "world" → "hello ", cursor=6
        s.deleteWordLeft(); // delete " hello" → "", cursor=0
        expect(s.text).toBe("");
        expect(s.cursorOffset).toBe(0);
    });

    it("does nothing at start", () => {
        const s = new InputState();
        s.value = "hello";
        s.moveCursorToStart();
        s.deleteWordLeft();
        expect(s.text).toBe("hello");
        expect(s.cursorOffset).toBe(0);
    });

    it("preserves text after cursor", () => {
        const s = new InputState();
        s.value = "foo bar baz";
        // move cursor to end of "bar" (pos=7)
        s.moveCursorToStart();
        for (let i = 0; i < 7; i++) s.moveCursorRight();
        s.deleteWordLeft(); // delete "bar" → "foo  baz", cursor=4
        expect(s.text).toBe("foo  baz");
        expect(s.cursorOffset).toBe(4);
    });
});

// ─── deleteWordRight ─────────────────────────────────────────

describe("InputState.deleteWordRight", () => {
    it("deletes word to the right from start", () => {
        const s = new InputState();
        s.value = "hello world";
        s.moveCursorToStart();
        s.deleteWordRight();
        expect(s.text).toBe(" world");
        expect(s.cursorOffset).toBe(0);
    });

    it("skips whitespace then deletes word", () => {
        const s = new InputState();
        s.value = "hello world";
        s.moveCursorToStart();
        s.deleteWordRight(); // delete "hello" → " world"
        s.deleteWordRight(); // skip space, delete "world" → ""
        expect(s.text).toBe("");
        expect(s.cursorOffset).toBe(0);
    });

    it("does nothing at end", () => {
        const s = new InputState();
        s.value = "hello";
        s.deleteWordRight();
        expect(s.text).toBe("hello");
        expect(s.cursorOffset).toBe(5);
    });

    it("preserves text before cursor", () => {
        const s = new InputState();
        s.value = "foo bar baz";
        // move cursor to start of "bar" (pos=4)
        s.moveCursorToStart();
        for (let i = 0; i < 4; i++) s.moveCursorRight();
        s.deleteWordRight(); // delete "bar" → "foo  baz", cursor stays at 4
        expect(s.text).toBe("foo  baz");
        expect(s.cursorOffset).toBe(4);
    });
});
