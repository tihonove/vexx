import { describe, expect, it } from "vitest";

import { LineSplitter, stripAnsi } from "./ansi.ts";

describe("stripAnsi", () => {
    it("removes SGR colour codes", () => {
        expect(stripAnsi("\x1b[31merror\x1b[0m: boom")).toBe("error: boom");
    });

    it("removes cursor-movement and OSC sequences", () => {
        expect(stripAnsi("\x1b[2K\x1b[1Gline")).toBe("line");
        expect(stripAnsi("\x1b]0;title\x07text")).toBe("text");
    });

    it("drops lone control chars but keeps tabs", () => {
        expect(stripAnsi("a\x00b\x7fc")).toBe("abc");
        expect(stripAnsi("col1\tcol2")).toBe("col1\tcol2");
    });

    it("leaves plain text untouched", () => {
        expect(stripAnsi("app.ts(3,5): error TS2322")).toBe("app.ts(3,5): error TS2322");
    });
});

describe("LineSplitter", () => {
    it("emits only complete lines and buffers the tail", () => {
        const s = new LineSplitter();
        expect(s.push("hello\nwor")).toEqual(["hello"]);
        expect(s.push("ld\n")).toEqual(["world"]);
        expect(s.flush()).toEqual([]);
    });

    it("splits multiple lines in one chunk", () => {
        const s = new LineSplitter();
        expect(s.push("a\nb\nc\n")).toEqual(["a", "b", "c"]);
    });

    it("strips a trailing CR (\\r\\n)", () => {
        const s = new LineSplitter();
        expect(s.push("dos\r\nnext\r\n")).toEqual(["dos", "next"]);
    });

    it("flush returns the unterminated remainder", () => {
        const s = new LineSplitter();
        expect(s.push("partial")).toEqual([]);
        expect(s.flush()).toEqual(["partial"]);
        expect(s.flush()).toEqual([]);
    });
});
