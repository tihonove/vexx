import { describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";

import { DEFAULT_COLOR } from "./ColorUtils.ts";
import { Grid } from "./Grid.ts";

describe("Grid — updateCell wide character support", () => {
    describe("updateCell with width=2", () => {
        it("sets up continuation cell when writing a wide char", () => {
            const grid = new Grid(new Size(10, 1));
            grid.updateCell(new Point(2, 0), { char: "漢", width: 2 });

            const head = grid.getCellAt(2, 0);
            expect(head.char).toBe("漢");
            expect(head.width).toBe(2);

            const cont = grid.getCellAt(3, 0);
            expect(cont.char).toBe("");
            expect(cont.width).toBe(0);
        });

        it("continuation cell inherits fg and bg from patch", () => {
            const grid = new Grid(new Size(10, 1));
            const fg = 0xff0000;
            const bg = 0x00ff00;
            grid.updateCell(new Point(0, 0), { char: "😀", fg, bg, width: 2 });

            const cont = grid.getCellAt(1, 0);
            expect(cont.fg).toBe(fg);
            expect(cont.bg).toBe(bg);
        });

        it("does not write continuation past the grid edge", () => {
            const grid = new Grid(new Size(5, 1));
            grid.updateCell(new Point(4, 0), { char: "漢", width: 2 });

            const head = grid.getCellAt(4, 0);
            expect(head.char).toBe("漢");
            expect(head.width).toBe(2);
            // No crash — continuation just not written
        });
    });

    describe("overwriting continuation cell via updateCell", () => {
        it("clears the head when a normal char overwrites a continuation cell", () => {
            const grid = new Grid(new Size(10, 1));
            grid.setCell(new Point(2, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);

            // Overwrite the continuation cell at x=3 with a normal char via updateCell
            grid.updateCell(new Point(3, 0), { char: "X", width: 1 });

            const head = grid.getCellAt(2, 0);
            expect(head.char).toBe(" ");
            expect(head.width).toBe(1);

            const newCell = grid.getCellAt(3, 0);
            expect(newCell.char).toBe("X");
            expect(newCell.width).toBe(1);
        });
    });

    describe("overwriting head cell via updateCell", () => {
        it("clears continuation when a normal char overwrites a wide char head", () => {
            const grid = new Grid(new Size(10, 1));
            grid.setCell(new Point(2, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);

            // Overwrite the head cell at x=2 via updateCell
            grid.updateCell(new Point(2, 0), { char: "A", width: 1 });

            const head = grid.getCellAt(2, 0);
            expect(head.char).toBe("A");
            expect(head.width).toBe(1);

            const cont = grid.getCellAt(3, 0);
            expect(cont.char).toBe(" ");
            expect(cont.width).toBe(1);
        });
    });

    describe("updateCell with only bg does not trigger wide-char logic", () => {
        it("updating only bg on a continuation cell preserves the wide char", () => {
            const grid = new Grid(new Size(10, 1));
            grid.setCell(new Point(2, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);

            // Update only bg on the continuation cell
            grid.updateCell(new Point(3, 0), { bg: 0xff0000 });

            // Wide char should remain intact
            const head = grid.getCellAt(2, 0);
            expect(head.char).toBe("漢");
            expect(head.width).toBe(2);

            const cont = grid.getCellAt(3, 0);
            expect(cont.width).toBe(0);
            expect(cont.bg).toBe(0xff0000);
        });

        it("updating only bg on a head cell preserves the wide char", () => {
            const grid = new Grid(new Size(10, 1));
            grid.setCell(new Point(2, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);

            // Update only bg on the head cell
            grid.updateCell(new Point(2, 0), { bg: 0xff0000 });

            const head = grid.getCellAt(2, 0);
            expect(head.char).toBe("漢");
            expect(head.width).toBe(2);
            expect(head.bg).toBe(0xff0000);

            const cont = grid.getCellAt(3, 0);
            expect(cont.width).toBe(0);
        });
    });

    describe("wide char overwriting another via updateCell", () => {
        it("replaces one wide char with another at the same position", () => {
            const grid = new Grid(new Size(10, 1));
            grid.setCell(new Point(2, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);
            grid.updateCell(new Point(2, 0), { char: "字", width: 2 });

            expect(grid.getCellAt(2, 0).char).toBe("字");
            expect(grid.getCellAt(2, 0).width).toBe(2);
            expect(grid.getCellAt(3, 0).char).toBe("");
            expect(grid.getCellAt(3, 0).width).toBe(0);
        });

        it("wide char via updateCell at continuation position clears previous head", () => {
            const grid = new Grid(new Size(10, 1));
            grid.setCell(new Point(0, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);

            // Write wide char at position 1 (which is continuation of pos 0)
            grid.updateCell(new Point(1, 0), { char: "字", width: 2 });

            // Head of first wide char (pos 0) should be cleaned up
            expect(grid.getCellAt(0, 0).char).toBe(" ");
            expect(grid.getCellAt(0, 0).width).toBe(1);

            // New wide char at pos 1-2
            expect(grid.getCellAt(1, 0).char).toBe("字");
            expect(grid.getCellAt(1, 0).width).toBe(2);
            expect(grid.getCellAt(2, 0).char).toBe("");
            expect(grid.getCellAt(2, 0).width).toBe(0);
        });
    });
});
