import { describe, expect, it } from "vitest";

import { DisplayLine } from "./DisplayLine.ts";

describe("DisplayLine — ASCII text", () => {
    it("handles empty string", () => {
        const dl = new DisplayLine("");
        expect(dl.displayWidth).toBe(0);
        expect(dl.slots.length).toBe(0);
    });

    it("maps each ASCII char to 1 column", () => {
        const dl = new DisplayLine("Hello");
        expect(dl.displayWidth).toBe(5);
        expect(dl.slots.length).toBe(5);
        for (let i = 0; i < 5; i++) {
            expect(dl.slots[i].displayWidth).toBe(1);
            expect(dl.slots[i].offset).toBe(i);
            expect(dl.slots[i].length).toBe(1);
        }
    });

    it("offsetToColumn is identity for ASCII", () => {
        const dl = new DisplayLine("abcde");
        for (let i = 0; i <= 5; i++) {
            expect(dl.offsetToColumn(i)).toBe(i);
        }
    });

    it("columnToOffset is identity for ASCII", () => {
        const dl = new DisplayLine("abcde");
        for (let i = 0; i <= 5; i++) {
            expect(dl.columnToOffset(i)).toBe(i);
        }
    });

    it("charAtColumn returns correct characters", () => {
        const dl = new DisplayLine("Hi!");
        expect(dl.charAtColumn(0)).toBe("H");
        expect(dl.charAtColumn(1)).toBe("i");
        expect(dl.charAtColumn(2)).toBe("!");
    });

    it("charAtColumn returns space for out-of-range columns", () => {
        const dl = new DisplayLine("AB");
        expect(dl.charAtColumn(-1)).toBe(" ");
        expect(dl.charAtColumn(2)).toBe(" ");
        expect(dl.charAtColumn(100)).toBe(" ");
    });

    it("graphemeAtColumn returns correct slots", () => {
        const dl = new DisplayLine("XY");
        expect(dl.graphemeAtColumn(0)?.grapheme).toBe("X");
        expect(dl.graphemeAtColumn(1)?.grapheme).toBe("Y");
        expect(dl.graphemeAtColumn(2)).toBeUndefined();
        expect(dl.graphemeAtColumn(-1)).toBeUndefined();
    });

    it("handles single character", () => {
        const dl = new DisplayLine("A");
        expect(dl.displayWidth).toBe(1);
        expect(dl.slots.length).toBe(1);
        expect(dl.offsetToColumn(0)).toBe(0);
        expect(dl.offsetToColumn(1)).toBe(1);
        expect(dl.columnToOffset(0)).toBe(0);
        expect(dl.columnToOffset(1)).toBe(1);
    });

    it("handles string with spaces", () => {
        const dl = new DisplayLine("a b c");
        expect(dl.displayWidth).toBe(5);
        expect(dl.charAtColumn(1)).toBe(" ");
        expect(dl.charAtColumn(3)).toBe(" ");
    });

    it("slotIndexAtOffset works for ASCII", () => {
        const dl = new DisplayLine("abc");
        expect(dl.slotIndexAtOffset(0)).toBe(0);
        expect(dl.slotIndexAtOffset(1)).toBe(1);
        expect(dl.slotIndexAtOffset(2)).toBe(2);
        expect(dl.slotIndexAtOffset(3)).toBe(-1);
        expect(dl.slotIndexAtOffset(-1)).toBe(-1);
    });
});
