import { describe, expect, it } from "vitest";

import { KeyInputParser } from "./keyInputParser.ts";

const START = "\x1b[200~";
const END = "\x1b[201~";

describe("KeyInputParser — bracketed paste", () => {
    it("delivers a wrapped paste as one text block, not as keystrokes", () => {
        const parser = new KeyInputParser();
        const out = parser.parseWithMouse(`${START}hello${END}`);
        expect(out.paste).toEqual(["hello"]);
        expect(out.keys).toEqual([]);
    });

    it("preserves newlines inside the paste instead of turning them into Enter keys", () => {
        const parser = new KeyInputParser();
        const out = parser.parseWithMouse(`${START}line one\nline two${END}`);
        expect(out.paste).toEqual(["line one\nline two"]);
        expect(out.keys).toEqual([]);
    });

    it("normalizes CRLF and lone CR line endings to LF", () => {
        const parser = new KeyInputParser();
        const out = parser.parseWithMouse(`${START}a\r\nb\rc${END}`);
        expect(out.paste).toEqual(["a\nb\nc"]);
    });

    it("keeps characters that look like CSI bytes literal (no ESC) inside the paste", () => {
        const parser = new KeyInputParser();
        const out = parser.parseWithMouse(`${START}arr[0] = x;${END}`);
        expect(out.paste).toEqual(["arr[0] = x;"]);
        expect(out.keys).toEqual([]);
    });

    it("suppresses an empty paste", () => {
        const parser = new KeyInputParser();
        const out = parser.parseWithMouse(`${START}${END}`);
        expect(out.paste).toEqual([]);
        expect(out.keys).toEqual([]);
    });

    it("types keys before and after a paste in the same chunk", () => {
        const parser = new KeyInputParser();
        const out = parser.parseWithMouse(`a${START}X${END}b`);
        expect(out.paste).toEqual(["X"]);
        const keyChars = out.keys.filter((e) => e.type === "keydown").map((e) => e.key);
        expect(keyChars).toEqual(["a", "b"]);
    });

    it("handles two pastes in a single chunk", () => {
        const parser = new KeyInputParser();
        const out = parser.parseWithMouse(`${START}one${END}${START}two${END}`);
        expect(out.paste).toEqual(["one", "two"]);
    });

    describe("split across stdin reads", () => {
        it("reassembles content split mid-paste", () => {
            const parser = new KeyInputParser();
            const first = parser.parseWithMouse(`${START}hello `);
            expect(first.paste).toEqual([]);
            const second = parser.parseWithMouse(`world${END}`);
            expect(second.paste).toEqual(["hello world"]);
        });

        it("reassembles a start marker split across reads", () => {
            const parser = new KeyInputParser();
            const first = parser.parseWithMouse("\x1b[200");
            expect(first.paste).toEqual([]);
            expect(parser.hasPending()).toBe(true);
            const second = parser.parseWithMouse(`~payload${END}`);
            expect(second.paste).toEqual(["payload"]);
        });

        it("reassembles an end marker split across reads without swallowing it as text", () => {
            const parser = new KeyInputParser();
            parser.parseWithMouse(`${START}data\x1b[201`);
            // The partial end marker is held back, not appended to the pasted text.
            expect(parser.hasPending()).toBe(true);
            const out = parser.parseWithMouse("~");
            expect(out.paste).toEqual(["data"]);
        });

        it("holds a lone trailing ESC mid-paste as a potential end marker", () => {
            const parser = new KeyInputParser();
            parser.parseWithMouse(`${START}ab\x1b`);
            expect(parser.hasPending()).toBe(true);
            const out = parser.parseWithMouse("[201~");
            expect(out.paste).toEqual(["ab"]);
        });
    });

    describe("flush during paste", () => {
        it("is a no-op and keeps accumulating (paste not truncated)", () => {
            const parser = new KeyInputParser();
            parser.parseWithMouse(`${START}partial\x1b[201`);
            const flushed = parser.flush();
            expect(flushed.paste).toEqual([]);
            expect(flushed.keys).toEqual([]);
            // The held state survives the flush; the paste completes when the rest arrives.
            const out = parser.parseWithMouse("~");
            expect(out.paste).toEqual(["partial"]);
        });
    });
});
