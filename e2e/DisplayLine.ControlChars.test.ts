import { describe, expect, it } from "vitest";

import { DisplayLine } from "./DisplayLine.ts";

describe("DisplayLine — Control Characters", () => {
    describe("carriage return (\\r)", () => {
        it("\\r has displayWidth 0", () => {
            const dl = new DisplayLine("a\rb");
            const crSlot = dl.slots.find((s) => s.grapheme === "\r");
            expect(crSlot).toBeDefined();
            expect(crSlot!.displayWidth).toBe(0);
        });

        it("\\r does not affect total display width", () => {
            const dl = new DisplayLine("abc\r");
            expect(dl.displayWidth).toBe(3);
        });

        it("\\r\\n at end of line — \\r has width 0", () => {
            // Note: in a real document, lines are split by \n, so a line
            // would contain "abc\r" (with the \n consumed by the line splitter).
            const dl = new DisplayLine("abc\r");
            expect(dl.displayWidth).toBe(3);
            expect(dl.slots.length).toBe(4); // a, b, c, \r
            expect(dl.slots[3].displayWidth).toBe(0);
        });

        it("offsetToColumn skips \\r correctly", () => {
            // "ab\rc" — \r at offset 2
            const dl = new DisplayLine("ab\rc");
            // offset 0 → col 0 (a)
            // offset 1 → col 1 (b)
            // offset 2 → col 2 (\r, width 0, so col stays 2)
            // offset 3 → col 2 (c)
            expect(dl.offsetToColumn(0)).toBe(0);
            expect(dl.offsetToColumn(1)).toBe(1);
            expect(dl.offsetToColumn(2)).toBe(2);
            expect(dl.offsetToColumn(3)).toBe(2);
            expect(dl.displayWidth).toBe(3);
        });

        it("columnToOffset with \\r present", () => {
            const dl = new DisplayLine("ab\rc");
            expect(dl.columnToOffset(0)).toBe(0); // a
            expect(dl.columnToOffset(1)).toBe(1); // b
            expect(dl.columnToOffset(2)).toBe(3); // c (skipping \r since it has width 0)
        });
    });

    describe("other control characters", () => {
        it("NUL (0x00) has displayWidth 0", () => {
            const dl = new DisplayLine("a\x00b");
            const nulSlot = dl.slots.find((s) => s.grapheme === "\x00");
            expect(nulSlot).toBeDefined();
            expect(nulSlot!.displayWidth).toBe(0);
            expect(dl.displayWidth).toBe(2); // only a and b visible
        });

        it("BEL (0x07) has displayWidth 0", () => {
            const dl = new DisplayLine("a\x07b");
            expect(dl.displayWidth).toBe(2);
        });
    });

    describe("mixed control characters", () => {
        it("text with \\r and \\t", () => {
            const dl = new DisplayLine("a\t\rb", 4);
            // a: col 0, width 1
            // \t: col 1, width 3
            // \r: col 4, width 0
            // b: col 4, width 1
            expect(dl.displayWidth).toBe(5);
            expect(dl.charAtColumn(0)).toBe("a");
            expect(dl.charAtColumn(1)).toBe(" "); // tab space
            expect(dl.charAtColumn(2)).toBe(" ");
            expect(dl.charAtColumn(3)).toBe(" ");
            expect(dl.charAtColumn(4)).toBe("b");
        });
    });
});
