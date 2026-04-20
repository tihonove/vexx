import { describe, expect, it } from "vitest";

import { DisplayLine } from "./DisplayLine.ts";

describe("DisplayLine — Combining characters", () => {
    describe("basic combining diacriticals", () => {
        it("e + combining acute (é) is one grapheme, 1 column", () => {
            const dl = new DisplayLine("e\u0301"); // e + ◌́
            expect(dl.slots.length).toBe(1);
            expect(dl.slots[0].displayWidth).toBe(1);
            expect(dl.slots[0].grapheme).toBe("e\u0301");
            expect(dl.slots[0].length).toBe(2); // 2 code units
            expect(dl.displayWidth).toBe(1);
        });

        it("offsetToColumn for combining mark", () => {
            const dl = new DisplayLine("e\u0301");
            expect(dl.offsetToColumn(0)).toBe(0); // base 'e'
            expect(dl.offsetToColumn(1)).toBe(0); // combining mark → same column as base
            expect(dl.offsetToColumn(2)).toBe(1); // past the end
        });
    });

    describe("combining mark in context", () => {
        it("ae\u0301b has 3 graphemes and 3 columns", () => {
            const dl = new DisplayLine("ae\u0301b");
            // a(1) + é(1) + b(1) = 3
            expect(dl.slots.length).toBe(3);
            expect(dl.displayWidth).toBe(3);
        });

        it("offsetToColumn for text with combining marks", () => {
            // "ae\u0301b"
            // offset 0 → col 0 (a)
            // offset 1 → col 1 (e, base of é)
            // offset 2 → col 1 (combining acute → same col as base)
            // offset 3 → col 2 (b)
            const dl = new DisplayLine("ae\u0301b");
            expect(dl.offsetToColumn(0)).toBe(0);
            expect(dl.offsetToColumn(1)).toBe(1);
            expect(dl.offsetToColumn(2)).toBe(1);
            expect(dl.offsetToColumn(3)).toBe(2);
        });

        it("columnToOffset for text with combining marks", () => {
            const dl = new DisplayLine("ae\u0301b");
            expect(dl.columnToOffset(0)).toBe(0); // a
            expect(dl.columnToOffset(1)).toBe(1); // é (offset of 'e')
            expect(dl.columnToOffset(2)).toBe(3); // b
        });

        it("charAtColumn returns full grapheme cluster", () => {
            const dl = new DisplayLine("ae\u0301b");
            expect(dl.charAtColumn(0)).toBe("a");
            expect(dl.charAtColumn(1)).toBe("e\u0301");
            expect(dl.charAtColumn(2)).toBe("b");
        });
    });

    describe("multiple combining marks on one base", () => {
        it("a + combining acute + combining tilde = 1 grapheme", () => {
            const dl = new DisplayLine("a\u0301\u0303");
            expect(dl.slots.length).toBe(1);
            expect(dl.slots[0].displayWidth).toBe(1);
            expect(dl.slots[0].length).toBe(3);
        });
    });

    describe("precomposed vs decomposed", () => {
        it("precomposed é (U+00E9) is 1 grapheme, 1 column, 1 code unit", () => {
            const dl = new DisplayLine("\u00e9");
            expect(dl.slots.length).toBe(1);
            expect(dl.slots[0].displayWidth).toBe(1);
            expect(dl.slots[0].length).toBe(1);
        });

        it("decomposed é (e + U+0301) is 1 grapheme, 1 column, 2 code units", () => {
            const dl = new DisplayLine("e\u0301");
            expect(dl.slots.length).toBe(1);
            expect(dl.slots[0].displayWidth).toBe(1);
            expect(dl.slots[0].length).toBe(2);
        });

        it("both have same display width", () => {
            const precomposed = new DisplayLine("\u00e9");
            const decomposed = new DisplayLine("e\u0301");
            expect(precomposed.displayWidth).toBe(decomposed.displayWidth);
        });
    });

    describe("combining marks with CJK", () => {
        it("CJK char + combining mark is still 2 columns", () => {
            // 漢 + combining acute — unusual but technically valid
            const dl = new DisplayLine("漢\u0301");
            expect(dl.slots.length).toBe(1);
            expect(dl.slots[0].displayWidth).toBe(2);
        });
    });

    describe("slotIndexAtOffset for combining characters", () => {
        it("combining mark offset maps to same slot as base", () => {
            const dl = new DisplayLine("e\u0301");
            expect(dl.slotIndexAtOffset(0)).toBe(0); // base 'e'
            expect(dl.slotIndexAtOffset(1)).toBe(0); // combining mark
        });
    });
});
