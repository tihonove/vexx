import { describe, expect, it } from "vitest";

import { createLineTokens, createToken } from "./ILineTokens.ts";
import { createRange } from "./IRange.ts";
import { createDeleteEdit, createInsertEdit, createTextEdit } from "./ITextEdit.ts";
import { TextDocument } from "./TextDocument.ts";

// ─── Construction ───────────────────────────────────────────

describe("TextDocument", () => {
    it("creates from empty string", () => {
        const doc = new TextDocument("");
        expect(doc.lineCount).toBe(1);
        expect(doc.getLineContent(0)).toBe("");
        expect(doc.getText()).toBe("");
    });

    it("creates from single line", () => {
        const doc = new TextDocument("hello world");
        expect(doc.lineCount).toBe(1);
        expect(doc.getLineContent(0)).toBe("hello world");
    });

    it("creates from multiple lines", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        expect(doc.lineCount).toBe(3);
        expect(doc.getLineContent(0)).toBe("aaa");
        expect(doc.getLineContent(1)).toBe("bbb");
        expect(doc.getLineContent(2)).toBe("ccc");
    });

    it("getLineLength returns correct length", () => {
        const doc = new TextDocument("ab\ncdef");
        expect(doc.getLineLength(0)).toBe(2);
        expect(doc.getLineLength(1)).toBe(4);
    });

    it("throws on invalid line index", () => {
        const doc = new TextDocument("hello");
        expect(() => doc.getLineContent(-1)).toThrow(RangeError);
        expect(() => doc.getLineContent(1)).toThrow(RangeError);
    });

    // ─── Single-line Insertion ──────────────────────────────

    it("inserts text in the middle of a line", () => {
        const doc = new TextDocument("helo");
        doc.applyEdits([createInsertEdit(0, 2, "l")]);
        expect(doc.getText()).toBe("hello");
    });

    it("inserts text at the beginning of a line", () => {
        const doc = new TextDocument("world");
        doc.applyEdits([createInsertEdit(0, 0, "hello ")]);
        expect(doc.getText()).toBe("hello world");
    });

    it("inserts text at the end of a line", () => {
        const doc = new TextDocument("hello");
        doc.applyEdits([createInsertEdit(0, 5, " world")]);
        expect(doc.getText()).toBe("hello world");
    });

    // ─── Multi-line Insertion ───────────────────────────────

    it("inserts a newline splitting one line into two", () => {
        const doc = new TextDocument("helloworld");
        doc.applyEdits([createInsertEdit(0, 5, "\n")]);
        expect(doc.lineCount).toBe(2);
        expect(doc.getLineContent(0)).toBe("hello");
        expect(doc.getLineContent(1)).toBe("world");
    });

    it("inserts multiple lines", () => {
        const doc = new TextDocument("ac");
        doc.applyEdits([createInsertEdit(0, 1, "\nbb\n")]);
        expect(doc.lineCount).toBe(3);
        expect(doc.getText()).toBe("a\nbb\nc");
    });

    // ─── Single-line Deletion ───────────────────────────────

    it("deletes characters within a single line", () => {
        const doc = new TextDocument("abcdef");
        doc.applyEdits([createDeleteEdit(0, 2, 0, 4)]);
        expect(doc.getText()).toBe("abef");
    });

    // ─── Multi-line Deletion ────────────────────────────────

    it("deletes across multiple lines", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        doc.applyEdits([createDeleteEdit(0, 1, 2, 1)]);
        expect(doc.lineCount).toBe(1);
        expect(doc.getText()).toBe("acc");
    });

    it("deletes an entire line by merging with the next", () => {
        const doc = new TextDocument("first\nsecond\nthird");
        doc.applyEdits([createDeleteEdit(0, 5, 1, 0)]);
        expect(doc.lineCount).toBe(2);
        expect(doc.getLineContent(0)).toBe("firstsecond");
        expect(doc.getLineContent(1)).toBe("third");
    });

    // ─── Replacement ────────────────────────────────────────

    it("replaces text within a single line", () => {
        const doc = new TextDocument("hello world");
        doc.applyEdits([createTextEdit(createRange(0, 0, 0, 5), "goodbye")]);
        expect(doc.getText()).toBe("goodbye world");
    });

    it("replaces a multi-line range with single line", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        doc.applyEdits([createTextEdit(createRange(0, 1, 2, 1), "X")]);
        expect(doc.getText()).toBe("aXcc");
    });

    it("replaces single-line range with multi-line text", () => {
        const doc = new TextDocument("aXcc");
        doc.applyEdits([createTextEdit(createRange(0, 1, 0, 2), "\nbbb\n")]);
        expect(doc.getText()).toBe("a\nbbb\ncc");
    });

    // ─── Multiple Edits ─────────────────────────────────────

    it("applies multiple non-overlapping edits simultaneously", () => {
        const doc = new TextDocument("abcdef");
        doc.applyEdits([createInsertEdit(0, 3, "X"), createInsertEdit(0, 0, "Y")]);
        expect(doc.getText()).toBe("YabcXdef");
    });

    it("applies multiple edits on different lines", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        doc.applyEdits([
            createTextEdit(createRange(0, 0, 0, 3), "AAA"),
            createTextEdit(createRange(2, 0, 2, 3), "CCC"),
        ]);
        expect(doc.getText()).toBe("AAA\nbbb\nCCC");
    });

    it("applies insert + delete edits that change line count", () => {
        const doc = new TextDocument("line1\nline2\nline3");
        doc.applyEdits([
            createDeleteEdit(1, 0, 1, 5), // clear line2 content
            createInsertEdit(0, 5, "\nnewLine"), // insert newLine after line1
        ]);
        expect(doc.getText()).toBe("line1\nnewLine\n\nline3");
    });

    // ─── Token Storage ──────────────────────────────────────

    it("stores and retrieves line tokens", () => {
        const doc = new TextDocument("hello world");
        const tokens = createLineTokens([createToken(0, "keyword"), createToken(6, "identifier")]);
        doc.setLineTokens(0, tokens);
        expect(doc.getLineTokens(0)).toEqual(tokens);
    });

    it("returns undefined for lines without tokens", () => {
        const doc = new TextDocument("hello");
        expect(doc.getLineTokens(0)).toBeUndefined();
    });

    // ─── Token Lazy Shifting ────────────────────────────────

    it("invalidates tokens on edited line", () => {
        const doc = new TextDocument("hello world");
        doc.setLineTokens(0, createLineTokens([createToken(0, "keyword")]));
        doc.applyEdits([createInsertEdit(0, 5, "X")]);
        expect(doc.getLineTokens(0)).toBeUndefined();
    });

    it("shifts token line indices down when inserting a newline", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const tokensBbb = createLineTokens([createToken(0, "B")]);
        const tokensCcc = createLineTokens([createToken(0, "C")]);
        doc.setLineTokens(1, tokensBbb);
        doc.setLineTokens(2, tokensCcc);

        // Insert a newline at the start of line 1 — pushes bbb and ccc down by 1
        doc.applyEdits([createInsertEdit(0, 3, "\nXXX")]);
        // Now: aaa / XXX / bbb / ccc (lines 0/1/2/3)
        expect(doc.getText()).toBe("aaa\nXXX\nbbb\nccc");

        // Line 0 (aaa) was edited — tokens invalidated on line 0
        // bbb was on line 1, now on line 2 — tokens should have shifted
        expect(doc.getLineTokens(2)).toEqual(tokensBbb);
        // ccc was on line 2, now on line 3
        expect(doc.getLineTokens(3)).toEqual(tokensCcc);
        // Line 1 (XXX) is new — no tokens
        expect(doc.getLineTokens(1)).toBeUndefined();
    });

    it("shifts token line indices up when deleting lines", () => {
        const doc = new TextDocument("aaa\nbbb\nccc\nddd");
        const tokensDdd = createLineTokens([createToken(0, "D")]);
        doc.setLineTokens(3, tokensDdd);

        // Delete line 1 entirely by merging it with line 0
        doc.applyEdits([createDeleteEdit(0, 3, 1, 3)]);
        // Now: aaa / ccc / ddd (lines 0/1/2)
        expect(doc.getText()).toBe("aaa\nccc\nddd");

        // ddd was on line 3, should now be on line 2
        expect(doc.getLineTokens(2)).toEqual(tokensDdd);
    });

    it("preserves tokens on lines above the edit", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const tokensAaa = createLineTokens([createToken(0, "A")]);
        doc.setLineTokens(0, tokensAaa);

        doc.applyEdits([createInsertEdit(2, 0, "X")]);
        // Line 0 is untouched — tokens should remain
        expect(doc.getLineTokens(0)).toEqual(tokensAaa);
    });

    // ─── Version ID ─────────────────────────────────────────

    it("starts with versionId 0", () => {
        const doc = new TextDocument("hello");
        expect(doc.versionId).toBe(0);
    });

    it("increments versionId on each applyEdits call", () => {
        const doc = new TextDocument("hello");
        doc.applyEdits([createInsertEdit(0, 5, " world")]);
        expect(doc.versionId).toBe(1);
        doc.applyEdits([createInsertEdit(0, 11, "!")]);
        expect(doc.versionId).toBe(2);
    });

    it("does not increment versionId for empty edits", () => {
        const doc = new TextDocument("hello");
        doc.applyEdits([]);
        expect(doc.versionId).toBe(0);
    });

    // ─── getTextInRange ─────────────────────────────────────

    it("getTextInRange returns text within a single line", () => {
        const doc = new TextDocument("hello world");
        expect(doc.getTextInRange(createRange(0, 0, 0, 5))).toBe("hello");
        expect(doc.getTextInRange(createRange(0, 6, 0, 11))).toBe("world");
    });

    it("getTextInRange returns text spanning multiple lines", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        expect(doc.getTextInRange(createRange(0, 1, 2, 2))).toBe("aa\nbbb\ncc");
    });

    it("getTextInRange returns empty string for collapsed range", () => {
        const doc = new TextDocument("hello");
        expect(doc.getTextInRange(createRange(0, 3, 0, 3))).toBe("");
    });

    // ─── Inverse Edits ──────────────────────────────────────

    it("returns inverse edits that undo a single-line insertion", () => {
        const doc = new TextDocument("hello");
        const { inverseEdits } = doc.applyEdits([createInsertEdit(0, 5, " world")]);
        expect(doc.getText()).toBe("hello world");
        doc.applyEdits(inverseEdits);
        expect(doc.getText()).toBe("hello");
    });

    it("returns inverse edits that undo a single-line deletion", () => {
        const doc = new TextDocument("hello world");
        const { inverseEdits } = doc.applyEdits([createDeleteEdit(0, 5, 0, 11)]);
        expect(doc.getText()).toBe("hello");
        doc.applyEdits(inverseEdits);
        expect(doc.getText()).toBe("hello world");
    });

    it("returns inverse edits that undo a replacement", () => {
        const doc = new TextDocument("hello world");
        const { inverseEdits } = doc.applyEdits([createTextEdit(createRange(0, 0, 0, 5), "goodbye")]);
        expect(doc.getText()).toBe("goodbye world");
        doc.applyEdits(inverseEdits);
        expect(doc.getText()).toBe("hello world");
    });

    it("returns inverse edits that undo a multi-line insertion", () => {
        const doc = new TextDocument("ac");
        const { inverseEdits } = doc.applyEdits([createInsertEdit(0, 1, "\nbb\n")]);
        expect(doc.getText()).toBe("a\nbb\nc");
        doc.applyEdits(inverseEdits);
        expect(doc.getText()).toBe("ac");
    });

    it("returns inverse edits that undo a multi-line deletion", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const { inverseEdits } = doc.applyEdits([createDeleteEdit(0, 1, 2, 1)]);
        expect(doc.getText()).toBe("acc");
        doc.applyEdits(inverseEdits);
        expect(doc.getText()).toBe("aaa\nbbb\nccc");
    });

    it("returns inverse edits for multiple simultaneous edits", () => {
        const doc = new TextDocument("abcdef");
        const original = doc.getText();
        const { inverseEdits } = doc.applyEdits([createInsertEdit(0, 3, "X"), createInsertEdit(0, 0, "Y")]);
        expect(doc.getText()).toBe("YabcXdef");
        doc.applyEdits(inverseEdits);
        expect(doc.getText()).toBe(original);
    });

    it("returns appliedVersion matching doc.versionId", () => {
        const doc = new TextDocument("hello");
        const { appliedVersion } = doc.applyEdits([createInsertEdit(0, 0, "X")]);
        expect(appliedVersion).toBe(doc.versionId);
        expect(appliedVersion).toBe(1);
    });
});
