import { describe, expect, it } from "vitest";

import { InputState } from "./inputState.ts";

/** Type a string one grapheme at a time, the way real keystrokes arrive. */
function type(state: InputState, chars: string): void {
    for (const ch of chars) state.insert(ch);
}

describe("InputState — undo/redo basics", () => {
    it("undo/redo are no-ops on an empty history", () => {
        const s = new InputState();
        expect(s.canUndo).toBe(false);
        expect(s.canRedo).toBe(false);
        s.undo();
        s.redo();
        expect(s.value).toBe("");
    });

    it("undoes a run of typing as a single step, then redoes it", () => {
        const s = new InputState();
        type(s, "abc");
        expect(s.value).toBe("abc");
        expect(s.canUndo).toBe(true);

        s.undo();
        expect(s.value).toBe("");
        expect(s.canRedo).toBe(true);

        s.redo();
        expect(s.value).toBe("abc");
        expect(s.cursorOffset).toBe(3);
    });

    it("a cursor move breaks the typing group into separate undo steps", () => {
        const s = new InputState();
        type(s, "ab");
        s.moveCursorToStart();
        type(s, "X");
        expect(s.value).toBe("Xab");

        s.undo();
        expect(s.value).toBe("ab");

        s.undo();
        expect(s.value).toBe("");
    });

    it("a new edit clears the redo stack", () => {
        const s = new InputState();
        type(s, "abc");
        s.undo();
        expect(s.canRedo).toBe(true);
        type(s, "z");
        expect(s.canRedo).toBe(false);
        expect(s.value).toBe("z");
    });
});

describe("InputState — undo grouping per edit kind", () => {
    it("paste (multi-char insert) is its own undo group", () => {
        const s = new InputState();
        type(s, "ab");
        s.insert("XYZ"); // paste
        expect(s.value).toBe("abXYZ");

        s.undo();
        expect(s.value).toBe("ab");

        s.undo();
        expect(s.value).toBe("");
    });

    it("consecutive backspaces coalesce into one undo step", () => {
        const s = new InputState();
        s.value = "hello"; // baseline, clears history
        s.deleteLeft();
        s.deleteLeft();
        expect(s.value).toBe("hel");

        s.undo();
        expect(s.value).toBe("hello");
    });

    it("typing then deleting are separate undo groups", () => {
        const s = new InputState();
        type(s, "ab");
        s.deleteLeft();
        expect(s.value).toBe("a");

        s.undo();
        expect(s.value).toBe("ab");

        s.undo();
        expect(s.value).toBe("");
    });

    it("word delete is its own undo group", () => {
        const s = new InputState();
        s.value = "hello world";
        s.deleteWordLeft();
        expect(s.value).toBe("hello ");

        s.undo();
        expect(s.value).toBe("hello world");
    });

    it("deleting a selection is its own undo group and restores the selection on undo", () => {
        const s = new InputState();
        s.value = "hello world";
        s.selectWordLeft(); // selects "world"
        s.deleteLeft();
        expect(s.value).toBe("hello ");

        s.undo();
        expect(s.value).toBe("hello world");
    });
});

describe("InputState — undo and programmatic value", () => {
    it("setting value clears undo/redo history", () => {
        const s = new InputState();
        type(s, "abc");
        expect(s.canUndo).toBe(true);

        s.value = "fresh";
        expect(s.canUndo).toBe(false);
        expect(s.canRedo).toBe(false);

        s.undo();
        expect(s.value).toBe("fresh");
    });
});
