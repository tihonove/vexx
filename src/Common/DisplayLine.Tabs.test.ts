import { describe, expect, it } from "vitest";

import { DisplayLine } from "./DisplayLine.ts";

describe("DisplayLine — Tabs", () => {
    describe("tab width calculation (tabSize=4)", () => {
        it("tab at column 0 has width 4", () => {
            const dl = new DisplayLine("\t", 4);
            expect(dl.slots.length).toBe(1);
            expect(dl.slots[0].displayWidth).toBe(4);
            expect(dl.displayWidth).toBe(4);
        });

        it("tab after 1 char has width 3", () => {
            const dl = new DisplayLine("a\t", 4);
            expect(dl.slots[1].displayWidth).toBe(3);
            expect(dl.displayWidth).toBe(4);
        });

        it("tab after 2 chars has width 2", () => {
            const dl = new DisplayLine("ab\t", 4);
            expect(dl.slots[2].displayWidth).toBe(2);
            expect(dl.displayWidth).toBe(4);
        });

        it("tab after 3 chars has width 1", () => {
            const dl = new DisplayLine("abc\t", 4);
            expect(dl.slots[3].displayWidth).toBe(1);
            expect(dl.displayWidth).toBe(4);
        });

        it("tab after 4 chars has width 4 (next tab stop)", () => {
            const dl = new DisplayLine("abcd\t", 4);
            expect(dl.slots[4].displayWidth).toBe(4);
            expect(dl.displayWidth).toBe(8);
        });
    });

    describe("multiple tabs", () => {
        it("two tabs at start", () => {
            const dl = new DisplayLine("\t\t", 4);
            expect(dl.slots[0].displayWidth).toBe(4);
            expect(dl.slots[1].displayWidth).toBe(4);
            expect(dl.displayWidth).toBe(8);
        });

        it("text between tabs", () => {
            const dl = new DisplayLine("\thi\t", 4);
            // \t: col 0→4 (width 4)
            // h: col 4 (width 1)
            // i: col 5 (width 1)
            // \t: col 6→8 (width 2)
            expect(dl.slots[0].displayWidth).toBe(4); // \t
            expect(dl.slots[1].grapheme).toBe("h");
            expect(dl.slots[2].grapheme).toBe("i");
            expect(dl.slots[3].displayWidth).toBe(2); // \t
            expect(dl.displayWidth).toBe(8);
        });
    });

    describe("tabSize=8", () => {
        it("tab at start has width 8", () => {
            const dl = new DisplayLine("\t", 8);
            expect(dl.slots[0].displayWidth).toBe(8);
            expect(dl.displayWidth).toBe(8);
        });

        it("tab after 3 chars has width 5", () => {
            const dl = new DisplayLine("abc\t", 8);
            expect(dl.slots[3].displayWidth).toBe(5);
        });
    });

    describe("tabSize=2", () => {
        it("tab at start has width 2", () => {
            const dl = new DisplayLine("\t", 2);
            expect(dl.slots[0].displayWidth).toBe(2);
        });

        it("tab after 1 char has width 1", () => {
            const dl = new DisplayLine("a\t", 2);
            expect(dl.slots[1].displayWidth).toBe(1);
        });
    });

    describe("offset↔column mapping with tabs", () => {
        it("offsetToColumn maps through tab correctly", () => {
            // "a\tb" with tabSize=4
            // offset 0 → col 0 ('a')
            // offset 1 → col 1 (tab starts at col 1, expands to col 4)
            // offset 2 → col 4 ('b')
            const dl = new DisplayLine("a\tb", 4);
            expect(dl.offsetToColumn(0)).toBe(0);
            expect(dl.offsetToColumn(1)).toBe(1);
            expect(dl.offsetToColumn(2)).toBe(4);
        });

        it("columnToOffset maps through tab correctly", () => {
            const dl = new DisplayLine("a\tb", 4);
            expect(dl.columnToOffset(0)).toBe(0); // 'a'
            expect(dl.columnToOffset(1)).toBe(1); // tab start
            expect(dl.columnToOffset(2)).toBe(1); // still inside tab
            expect(dl.columnToOffset(3)).toBe(1); // still inside tab
            expect(dl.columnToOffset(4)).toBe(2); // 'b'
        });

        it("charAtColumn renders tab as spaces", () => {
            const dl = new DisplayLine("a\tb", 4);
            expect(dl.charAtColumn(0)).toBe("a");
            expect(dl.charAtColumn(1)).toBe(" ");
            expect(dl.charAtColumn(2)).toBe(" ");
            expect(dl.charAtColumn(3)).toBe(" ");
            expect(dl.charAtColumn(4)).toBe("b");
        });
    });

    describe("graphemeAtColumn for tabs", () => {
        it("all columns within tab point to the same slot", () => {
            const dl = new DisplayLine("\t", 4);
            const slot = dl.graphemeAtColumn(0);
            expect(slot).toBeDefined();
            expect(slot!.grapheme).toBe("\t");
            expect(dl.graphemeAtColumn(1)?.grapheme).toBe("\t");
            expect(dl.graphemeAtColumn(2)?.grapheme).toBe("\t");
            expect(dl.graphemeAtColumn(3)?.grapheme).toBe("\t");
        });
    });
});
