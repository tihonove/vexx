import { describe, expect, it } from "vitest";

import { DisplayLine } from "./DisplayLine.ts";

describe("DisplayLine — CJK characters", () => {
    describe("basic CJK ideographs", () => {
        it("漢 occupies 2 columns, 1 code unit", () => {
            const dl = new DisplayLine("漢");
            expect(dl.slots.length).toBe(1);
            expect(dl.slots[0].displayWidth).toBe(2);
            expect(dl.slots[0].length).toBe(1);
            expect(dl.displayWidth).toBe(2);
        });

        it("charAtColumn returns CJK char in first col, '' in second", () => {
            const dl = new DisplayLine("漢");
            expect(dl.charAtColumn(0)).toBe("漢");
            expect(dl.charAtColumn(1)).toBe("");
        });
    });

    describe("mixed ASCII and CJK", () => {
        it("a漢b has display width 4", () => {
            const dl = new DisplayLine("a漢b");
            // a(1) + 漢(2) + b(1) = 4
            expect(dl.displayWidth).toBe(4);
            expect(dl.slots.length).toBe(3);
        });

        it("offsetToColumn for mixed text", () => {
            const dl = new DisplayLine("a漢b");
            expect(dl.offsetToColumn(0)).toBe(0); // a
            expect(dl.offsetToColumn(1)).toBe(1); // 漢
            expect(dl.offsetToColumn(2)).toBe(3); // b
        });

        it("columnToOffset for mixed text", () => {
            const dl = new DisplayLine("a漢b");
            expect(dl.columnToOffset(0)).toBe(0); // a
            expect(dl.columnToOffset(1)).toBe(1); // 漢
            expect(dl.columnToOffset(2)).toBe(1); // 2nd col of 漢 → offset of 漢
            expect(dl.columnToOffset(3)).toBe(2); // b
        });

        it("charAtColumn for mixed text", () => {
            const dl = new DisplayLine("a漢b");
            expect(dl.charAtColumn(0)).toBe("a");
            expect(dl.charAtColumn(1)).toBe("漢");
            expect(dl.charAtColumn(2)).toBe("");
            expect(dl.charAtColumn(3)).toBe("b");
        });
    });

    describe("multiple CJK characters", () => {
        it("漢字 has display width 4", () => {
            const dl = new DisplayLine("漢字");
            expect(dl.displayWidth).toBe(4);
            expect(dl.slots.length).toBe(2);
        });

        it("consecutive CJK with ASCII", () => {
            const dl = new DisplayLine("A漢字B");
            // A(1) + 漢(2) + 字(2) + B(1) = 6
            expect(dl.displayWidth).toBe(6);
        });
    });

    describe("Hiragana and Katakana", () => {
        it("あ (hiragana) is 2 columns wide", () => {
            const dl = new DisplayLine("あ");
            expect(dl.displayWidth).toBe(2);
        });

        it("ア (katakana) is 2 columns wide", () => {
            const dl = new DisplayLine("ア");
            expect(dl.displayWidth).toBe(2);
        });
    });

    describe("Hangul", () => {
        it("가 (hangul syllable) is 2 columns wide", () => {
            const dl = new DisplayLine("가");
            expect(dl.displayWidth).toBe(2);
        });
    });

    describe("Fullwidth forms", () => {
        it("Ａ (fullwidth A) is 2 columns wide", () => {
            const dl = new DisplayLine("\uff21"); // Ａ
            expect(dl.displayWidth).toBe(2);
        });

        it("！ (fullwidth !) is 2 columns wide", () => {
            const dl = new DisplayLine("\uff01");
            expect(dl.displayWidth).toBe(2);
        });
    });

    describe("graphemeAtColumn for CJK", () => {
        it("both columns of CJK char point to same slot", () => {
            const dl = new DisplayLine("漢");
            const slot0 = dl.graphemeAtColumn(0);
            const slot1 = dl.graphemeAtColumn(1);
            expect(slot0).toBeDefined();
            expect(slot1).toBeDefined();
            expect(slot0!.grapheme).toBe("漢");
            expect(slot1!.grapheme).toBe("漢");
        });
    });

    describe("CJK with tabs", () => {
        it("tab after CJK character", () => {
            // 漢(2) + \t → column 2, tab width = 4 - (2 % 4) = 2
            const dl = new DisplayLine("漢\t", 4);
            expect(dl.slots[0].displayWidth).toBe(2);
            expect(dl.slots[1].displayWidth).toBe(2);
            expect(dl.displayWidth).toBe(4);
        });
    });
});
