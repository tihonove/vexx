import { describe, expect, it } from "vitest";

import { DisplayLine } from "./DisplayLine.ts";

describe("DisplayLine — Emoji", () => {
    describe("simple emoji (surrogate pairs)", () => {
        it("😀 occupies 2 columns", () => {
            const dl = new DisplayLine("😀");
            expect(dl.slots.length).toBe(1);
            expect(dl.slots[0].displayWidth).toBe(2);
            expect(dl.slots[0].length).toBe(2); // surrogate pair = 2 code units
            expect(dl.displayWidth).toBe(2);
        });

        it("charAtColumn returns emoji in first column and '' in second", () => {
            const dl = new DisplayLine("😀");
            expect(dl.charAtColumn(0)).toBe("😀");
            expect(dl.charAtColumn(1)).toBe("");
        });

        it("offsetToColumn for surrogate pair", () => {
            // "A😀B"
            // A: offset 0, col 0
            // 😀: offset 1 (2 code units), col 1-2
            // B: offset 3, col 3
            const dl = new DisplayLine("A😀B");
            expect(dl.offsetToColumn(0)).toBe(0); // A
            expect(dl.offsetToColumn(1)).toBe(1); // 😀 start
            expect(dl.offsetToColumn(2)).toBe(1); // 😀 second code unit → same column
            expect(dl.offsetToColumn(3)).toBe(3); // B
        });

        it("columnToOffset for surrogate pair", () => {
            const dl = new DisplayLine("A😀B");
            expect(dl.columnToOffset(0)).toBe(0); // A
            expect(dl.columnToOffset(1)).toBe(1); // 😀
            expect(dl.columnToOffset(2)).toBe(1); // 2nd col of 😀 → offset of 😀
            expect(dl.columnToOffset(3)).toBe(3); // B
        });
    });

    describe("emoji with ZWJ sequences", () => {
        it("👨‍👩‍👧‍👦 is one grapheme cluster with 2 columns", () => {
            const family = "👨\u200d👩\u200d👧\u200d👦";
            const dl = new DisplayLine(family);
            expect(dl.slots.length).toBe(1);
            expect(dl.slots[0].displayWidth).toBe(2);
            expect(dl.slots[0].grapheme).toBe(family);
        });

        it("text around ZWJ emoji", () => {
            const family = "👨\u200d👩\u200d👧\u200d👦";
            const dl = new DisplayLine("A" + family + "B");
            // A (1) + family (2) + B (1) = 4
            expect(dl.displayWidth).toBe(4);
        });
    });

    describe("emoji with skin tone modifier", () => {
        it("👍🏽 is one grapheme cluster with 2 columns", () => {
            const thumbs = "👍🏽";
            const dl = new DisplayLine(thumbs);
            expect(dl.slots.length).toBe(1);
            expect(dl.slots[0].displayWidth).toBe(2);
            expect(dl.slots[0].grapheme).toBe(thumbs);
        });
    });

    describe("flag emoji", () => {
        it("🇺🇸 is one grapheme cluster with 2 columns", () => {
            const flag = "🇺🇸";
            const dl = new DisplayLine(flag);
            expect(dl.slots.length).toBe(1);
            expect(dl.slots[0].displayWidth).toBe(2);
        });
    });

    describe("multiple emoji", () => {
        it("handles consecutive emoji", () => {
            const dl = new DisplayLine("😀🚀");
            expect(dl.slots.length).toBe(2);
            expect(dl.displayWidth).toBe(4); // 2 + 2
            expect(dl.charAtColumn(0)).toBe("😀");
            expect(dl.charAtColumn(1)).toBe("");
            expect(dl.charAtColumn(2)).toBe("🚀");
            expect(dl.charAtColumn(3)).toBe("");
        });

        it("emoji mixed with ASCII", () => {
            const dl = new DisplayLine("a😀b🚀c");
            // a(1) + 😀(2) + b(1) + 🚀(2) + c(1) = 7
            expect(dl.displayWidth).toBe(7);
            expect(dl.charAtColumn(0)).toBe("a");
            expect(dl.charAtColumn(1)).toBe("😀");
            expect(dl.charAtColumn(2)).toBe("");
            expect(dl.charAtColumn(3)).toBe("b");
            expect(dl.charAtColumn(4)).toBe("🚀");
            expect(dl.charAtColumn(5)).toBe("");
            expect(dl.charAtColumn(6)).toBe("c");
        });
    });

    describe("graphemeAtColumn with emoji", () => {
        it("both columns of emoji point to same slot", () => {
            const dl = new DisplayLine("😀");
            const slot0 = dl.graphemeAtColumn(0);
            const slot1 = dl.graphemeAtColumn(1);
            expect(slot0).toBeDefined();
            expect(slot1).toBeDefined();
            expect(slot0!.grapheme).toBe("😀");
            expect(slot1!.grapheme).toBe("😀");
        });
    });
});
