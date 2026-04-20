import { describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";

import { DEFAULT_COLOR } from "./ColorUtils.ts";
import { Grid } from "./Grid.ts";

describe("Grid — wide character support", () => {
    describe("setCell with width=2", () => {
        it("sets head cell with width=2 and continuation cell with width=0", () => {
            const grid = new Grid(new Size(10, 1));
            grid.setCell(new Point(2, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);

            const head = grid.getCellAt(2, 0);
            expect(head.char).toBe("漢");
            expect(head.width).toBe(2);

            const cont = grid.getCellAt(3, 0);
            expect(cont.char).toBe("");
            expect(cont.width).toBe(0);
        });

        it("continuation cell inherits fg, bg, style from head", () => {
            const grid = new Grid(new Size(10, 1));
            const fg = 0xff0000;
            const bg = 0x00ff00;
            grid.setCell(new Point(0, 0), "😀", fg, bg, 0, 2);

            const cont = grid.getCellAt(1, 0);
            expect(cont.fg).toBe(fg);
            expect(cont.bg).toBe(bg);
        });

        it("does not write continuation past the grid edge", () => {
            const grid = new Grid(new Size(5, 1));
            // Writing a wide char at the last column — continuation would be out of bounds
            grid.setCell(new Point(4, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);

            const head = grid.getCellAt(4, 0);
            expect(head.char).toBe("漢");
            expect(head.width).toBe(2);
            // No crash — continuation just not written
        });
    });

    describe("overwriting continuation cell", () => {
        it("clears the head when a normal char overwrites a continuation cell", () => {
            const grid = new Grid(new Size(10, 1));
            grid.setCell(new Point(2, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);

            // Overwrite the continuation cell at x=3 with a normal char
            grid.setCell(new Point(3, 0), "X");

            // Head cell at x=2 should be cleared to a space
            const head = grid.getCellAt(2, 0);
            expect(head.char).toBe(" ");
            expect(head.width).toBe(1);

            // New char at x=3
            const newCell = grid.getCellAt(3, 0);
            expect(newCell.char).toBe("X");
            expect(newCell.width).toBe(1);
        });
    });

    describe("overwriting head cell", () => {
        it("clears continuation when a normal char overwrites a wide char head", () => {
            const grid = new Grid(new Size(10, 1));
            grid.setCell(new Point(2, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);

            // Overwrite the head cell at x=2 with a normal char
            grid.setCell(new Point(2, 0), "A");

            const head = grid.getCellAt(2, 0);
            expect(head.char).toBe("A");
            expect(head.width).toBe(1);

            // Continuation cell at x=3 should be cleaned up
            const cont = grid.getCellAt(3, 0);
            expect(cont.char).toBe(" ");
            expect(cont.width).toBe(1);
        });
    });

    describe("overwriting with another wide char", () => {
        it("wide char overwriting another wide char at same position", () => {
            const grid = new Grid(new Size(10, 1));
            grid.setCell(new Point(2, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);
            grid.setCell(new Point(2, 0), "字", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);

            expect(grid.getCellAt(2, 0).char).toBe("字");
            expect(grid.getCellAt(2, 0).width).toBe(2);
            expect(grid.getCellAt(3, 0).char).toBe("");
            expect(grid.getCellAt(3, 0).width).toBe(0);
        });

        it("wide char overwriting continuation + next char", () => {
            const grid = new Grid(new Size(10, 1));
            // Set two wide chars: "漢字" at positions 0-1 and 2-3
            grid.setCell(new Point(0, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);
            grid.setCell(new Point(2, 0), "字", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);

            // Now overwrite starting at position 1 (the continuation of 漢)
            grid.setCell(new Point(1, 0), "X");

            // Head of first wide char (pos 0) should be cleaned up
            expect(grid.getCellAt(0, 0).char).toBe(" ");
            expect(grid.getCellAt(0, 0).width).toBe(1);

            // New char at pos 1
            expect(grid.getCellAt(1, 0).char).toBe("X");
            expect(grid.getCellAt(1, 0).width).toBe(1);

            // Wide char at 2-3 should be untouched
            expect(grid.getCellAt(2, 0).char).toBe("字");
            expect(grid.getCellAt(2, 0).width).toBe(2);
        });
    });

    describe("cellEqualsAt with width", () => {
        it("cells with different width are not equal", () => {
            const a = new Grid(new Size(4, 1));
            const b = new Grid(new Size(4, 1));

            a.setCell(new Point(0, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);
            b.setCell(new Point(0, 0), "漢");

            expect(a.cellEqualsAt(0, 0, b)).toBe(false);
        });
    });

    describe("fill resets width", () => {
        it("fill resets all cells to width=1", () => {
            const grid = new Grid(new Size(4, 1));
            grid.setCell(new Point(0, 0), "漢", DEFAULT_COLOR, DEFAULT_COLOR, 0, 2);
            grid.fill();

            for (let x = 0; x < 4; x++) {
                expect(grid.getCellAt(x, 0).width).toBe(1);
                expect(grid.getCellAt(x, 0).char).toBe(" ");
            }
        });
    });

    describe("default width", () => {
        it("new cells have width=1 by default", () => {
            const grid = new Grid(new Size(3, 1));
            expect(grid.getCellAt(0, 0).width).toBe(1);
            expect(grid.getCellAt(1, 0).width).toBe(1);
        });

        it("setCell without width argument defaults to 1", () => {
            const grid = new Grid(new Size(3, 1));
            grid.setCell(new Point(0, 0), "A");
            expect(grid.getCellAt(0, 0).width).toBe(1);
        });
    });
});
