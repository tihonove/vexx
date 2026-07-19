import { describe, expect, it } from "vitest";

import { DisplayLine } from "./displayLine.ts";

describe("DisplayLine — boundary & contract edge cases", () => {
    describe("offsetToColumn", () => {
        it("clamps negative offsets to column 0", () => {
            const dl = new DisplayLine("abc");
            expect(dl.offsetToColumn(-1)).toBe(0);
            expect(dl.offsetToColumn(-100)).toBe(0);
        });

        it("clamps offsets past the end to the total width", () => {
            const dl = new DisplayLine("abc");
            expect(dl.offsetToColumn(3)).toBe(3);
            expect(dl.offsetToColumn(4)).toBe(3);
            expect(dl.offsetToColumn(100)).toBe(3);
        });

        it("returns the cluster-start column for an offset inside a wide grapheme", () => {
            // "A😀B": 😀 is a surrogate pair at offset 1, occupying columns 1-2
            const dl = new DisplayLine("A😀B");
            expect(dl.offsetToColumn(2)).toBe(1); // second code unit of 😀 → cluster start col
        });

        it("returns 0 for the only offset of an empty line", () => {
            const dl = new DisplayLine("");
            expect(dl.offsetToColumn(0)).toBe(0);
            expect(dl.offsetToColumn(5)).toBe(0);
            expect(dl.offsetToColumn(-5)).toBe(0);
        });
    });

    describe("columnToOffset", () => {
        it("clamps negative columns to offset 0", () => {
            const dl = new DisplayLine("abc");
            expect(dl.columnToOffset(-1)).toBe(0);
            expect(dl.columnToOffset(-50)).toBe(0);
        });

        it("clamps columns at/past the width to the raw length", () => {
            const dl = new DisplayLine("abc");
            expect(dl.columnToOffset(3)).toBe(3);
            expect(dl.columnToOffset(4)).toBe(3);
            expect(dl.columnToOffset(100)).toBe(3);
        });

        it("maps the second cell of a wide char back to that char's offset", () => {
            // "中" is a wide CJK char (2 cols) at offset 0
            const dl = new DisplayLine("中A");
            expect(dl.columnToOffset(0)).toBe(0); // first cell of 中
            expect(dl.columnToOffset(1)).toBe(0); // second cell of 中 → still offset 0
            expect(dl.columnToOffset(2)).toBe(1); // A
        });

        it("returns 0 for any column on an empty line", () => {
            const dl = new DisplayLine("");
            expect(dl.columnToOffset(0)).toBe(0);
            expect(dl.columnToOffset(10)).toBe(0);
            expect(dl.columnToOffset(-10)).toBe(0);
        });
    });

    describe("graphemeAtColumn", () => {
        it("returns the wide slot for both of its columns", () => {
            const dl = new DisplayLine("中");
            expect(dl.graphemeAtColumn(0)?.grapheme).toBe("中");
            expect(dl.graphemeAtColumn(1)?.grapheme).toBe("中"); // second cell still maps to slot
        });

        it("returns undefined for out-of-range and empty lines", () => {
            const dl = new DisplayLine("");
            expect(dl.graphemeAtColumn(0)).toBeUndefined();
            expect(dl.graphemeAtColumn(-1)).toBeUndefined();
            expect(dl.graphemeAtColumn(5)).toBeUndefined();
        });
    });

    describe("charAtColumn", () => {
        it("returns a space for every column of a tab", () => {
            const dl = new DisplayLine("\t", 4);
            expect(dl.displayWidth).toBe(4);
            for (let c = 0; c < 4; c++) {
                expect(dl.charAtColumn(c)).toBe(" ");
            }
        });

        it("returns space on an empty line for any column", () => {
            const dl = new DisplayLine("");
            expect(dl.charAtColumn(0)).toBe(" ");
            expect(dl.charAtColumn(-1)).toBe(" ");
        });
    });

    describe("slotIndexAtOffset", () => {
        it("resolves an offset in the middle of a surrogate pair to its slot", () => {
            // "A😀B": 😀 spans offsets 1-2 (one slot at index 1)
            const dl = new DisplayLine("A😀B");
            expect(dl.slotIndexAtOffset(1)).toBe(1); // start of 😀
            expect(dl.slotIndexAtOffset(2)).toBe(1); // middle code unit of 😀 → same slot
            expect(dl.slotIndexAtOffset(3)).toBe(2); // B
        });

        it("returns -1 for out-of-range offsets and empty lines", () => {
            const dl = new DisplayLine("");
            expect(dl.slotIndexAtOffset(0)).toBe(-1);
            expect(dl.slotIndexAtOffset(-1)).toBe(-1);
            expect(dl.slotIndexAtOffset(5)).toBe(-1);
        });

        it("binary search lands on every slot of a longer line", () => {
            const dl = new DisplayLine("abcdefgh");
            for (let i = 0; i < 8; i++) {
                expect(dl.slotIndexAtOffset(i)).toBe(i);
            }
        });
    });

    describe("custom tab size", () => {
        it("honours a non-default tab size and column alignment", () => {
            const dl = new DisplayLine("a\tb", 8);
            // a -> col 0 (w1), tab fills to next multiple of 8 -> w7, b -> col 8
            expect(dl.slots[1].displayWidth).toBe(7);
            expect(dl.displayWidth).toBe(9);
            expect(dl.offsetToColumn(2)).toBe(8); // b sits at column 8
        });
    });
});
