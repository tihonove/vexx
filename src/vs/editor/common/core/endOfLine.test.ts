import { describe, expect, it } from "vitest";

import { detectEndOfLine, EndOfLine, eolToSequence } from "./endOfLine.ts";

describe("eolToSequence", () => {
    it("maps LF to \\n", () => {
        expect(eolToSequence(EndOfLine.LF)).toBe("\n");
    });

    it("maps CRLF to \\r\\n", () => {
        expect(eolToSequence(EndOfLine.CRLF)).toBe("\r\n");
    });
});

describe("detectEndOfLine", () => {
    it("defaults to LF for empty text", () => {
        expect(detectEndOfLine("")).toBe(EndOfLine.LF);
    });

    it("defaults to LF for a single line without line breaks", () => {
        expect(detectEndOfLine("hello world")).toBe(EndOfLine.LF);
    });

    it("detects pure LF", () => {
        expect(detectEndOfLine("a\nb\nc")).toBe(EndOfLine.LF);
    });

    it("detects pure CRLF", () => {
        expect(detectEndOfLine("a\r\nb\r\nc")).toBe(EndOfLine.CRLF);
    });

    it("picks the prevailing sequence in mixed text (CRLF majority)", () => {
        expect(detectEndOfLine("a\r\nb\r\nc\nd")).toBe(EndOfLine.CRLF);
    });

    it("picks the prevailing sequence in mixed text (LF majority)", () => {
        expect(detectEndOfLine("a\r\nb\nc\nd")).toBe(EndOfLine.LF);
    });

    it("resolves a tie to LF", () => {
        expect(detectEndOfLine("a\r\nb\nc")).toBe(EndOfLine.LF);
    });

    it("treats a trailing CRLF as CRLF", () => {
        expect(detectEndOfLine("only\r\n")).toBe(EndOfLine.CRLF);
    });
});
