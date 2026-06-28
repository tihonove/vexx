import { describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";

import { DEFAULT_COLOR, packRgb } from "./ColorUtils.ts";
import { Grid } from "./Grid.ts";
import { StyleFlags } from "./StyleFlags.ts";

describe("Grid", () => {
    describe("constructor", () => {
        it("creates grid with given dimensions", () => {
            const grid = new Grid(new Size(10, 5));
            expect(grid.width).toBe(10);
            expect(grid.height).toBe(5);
        });

        it("allocates width × height cells", () => {
            const grid = new Grid(new Size(4, 3));
            expect(grid.cellCount).toBe(12);
        });

        it("initializes all cells as empty spaces", () => {
            const grid = new Grid(new Size(3, 2));
            for (let y = 0; y < grid.height; y++) {
                for (let x = 0; x < grid.width; x++) {
                    const cell = grid.getCellAt(x, y);
                    expect(cell.char).toBe(" ");
                    expect(cell.fg).toBe(DEFAULT_COLOR);
                    expect(cell.bg).toBe(DEFAULT_COLOR);
                    expect(cell.style).toBe(StyleFlags.None);
                }
            }
        });
    });

    describe("getCell", () => {
        it("returns the cell at (x, y)", () => {
            const grid = new Grid(new Size(5, 3));
            grid.setCell(new Point(2, 1), "X");
            expect(grid.getCell(new Point(2, 1)).char).toBe("X");
        });

        it("reflects mutations via setCell", () => {
            const grid = new Grid(new Size(3, 3));
            grid.setCell(new Point(1, 2), "!");
            expect(grid.getCell(new Point(1, 2)).char).toBe("!");
        });
    });

    describe("setCell", () => {
        it("sets char, fg, bg, style on the cell at (x, y)", () => {
            const grid = new Grid(new Size(4, 4));
            const red = packRgb(255, 0, 0);
            const blue = packRgb(0, 0, 255);
            grid.setCell(new Point(2, 3), "A", red, blue, StyleFlags.Bold);

            const cell = grid.getCell(new Point(2, 3));
            expect(cell.char).toBe("A");
            expect(cell.fg).toBe(red);
            expect(cell.bg).toBe(blue);
            expect(cell.style).toBe(StyleFlags.Bold);
        });

        it("uses explicitly provided fg, bg, style and width (no defaults)", () => {
            const grid = new Grid(new Size(4, 1));
            const red = packRgb(255, 0, 0);
            const blue = packRgb(0, 0, 255);
            grid.setCell(new Point(0, 0), "好", red, blue, StyleFlags.Underline, 2);

            const cell = grid.getCellAt(0, 0);
            expect(cell.fg).toBe(red);
            expect(cell.bg).toBe(blue);
            expect(cell.style).toBe(StyleFlags.Underline);
            expect(cell.width).toBe(2);
        });

        it("defaults fg/bg to DEFAULT_COLOR and style to None", () => {
            const grid = new Grid(new Size(2, 2));
            grid.setCell(new Point(0, 0), "B");

            const cell = grid.getCell(new Point(0, 0));
            expect(cell.char).toBe("B");
            expect(cell.fg).toBe(DEFAULT_COLOR);
            expect(cell.bg).toBe(DEFAULT_COLOR);
            expect(cell.style).toBe(StyleFlags.None);
        });
    });

    describe("setCell wide characters", () => {
        it("sets up a continuation cell for a width-2 char", () => {
            const grid = new Grid(new Size(4, 1));
            grid.setCell(new Point(0, 0), "好", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 2);

            const head = grid.getCellAt(0, 0);
            const cont = grid.getCellAt(1, 0);
            expect(head.char).toBe("好");
            expect(head.width).toBe(2);
            expect(cont.char).toBe("");
            expect(cont.width).toBe(0);
        });

        it("does not create a continuation cell when a width-2 char sits at the last column", () => {
            const grid = new Grid(new Size(2, 1));
            // x + 1 (== 2) is not < width (2): branch at line 79 / 94 is false
            grid.setCell(new Point(1, 0), "好", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 2);

            const head = grid.getCellAt(1, 0);
            expect(head.char).toBe("好");
            expect(head.width).toBe(2);
        });

        it("clears the head when overwriting a continuation cell (line 73 true branch)", () => {
            const grid = new Grid(new Size(4, 1));
            grid.setCell(new Point(0, 0), "好", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 2);
            // Now overwrite the continuation cell at x=1; its head at x=0 is width 2
            grid.setCell(new Point(1, 0), "A");

            const head = grid.getCellAt(0, 0);
            expect(head.char).toBe(" ");
            expect(head.width).toBe(1);
            expect(grid.getCellAt(1, 0).char).toBe("A");
        });

        it("leaves the previous cell untouched when overwriting a non-continuation cell whose neighbour is not a wide head (line 73 false branch)", () => {
            const grid = new Grid(new Size(4, 1));
            // Manually create a continuation-like cell (width 0) at x=1 whose head at x=0 is NOT width 2
            grid.setCell(new Point(0, 0), "A", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 1);
            grid.updateCell(new Point(1, 0), { width: 0 });
            // x>0 and cell.width===0, but head.width !== 2 → false branch of line 73
            grid.setCell(new Point(1, 0), "B");

            expect(grid.getCellAt(0, 0).char).toBe("A");
            expect(grid.getCellAt(1, 0).char).toBe("B");
        });

        it("clears the continuation when overwriting a wide head with a narrow char (line 81 true branch)", () => {
            const grid = new Grid(new Size(4, 1));
            grid.setCell(new Point(0, 0), "好", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 2);
            // Overwrite head at x=0 with a narrow char; continuation at x=1 (width 0) must be cleared
            grid.setCell(new Point(0, 0), "A");

            const cont = grid.getCellAt(1, 0);
            expect(cont.char).toBe(" ");
            expect(cont.width).toBe(1);
        });

        it("clears a clobbered wide head's stale continuation when placing a new wide char (line 99 true branch)", () => {
            const grid = new Grid(new Size(5, 1));
            // Place a wide char at x=1 first, so x=1 is head (width 2), x=2 is continuation (width 0)
            grid.setCell(new Point(1, 0), "好", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 2);
            // Now place a new wide char at x=0: its continuation lands on x=1 (width-2 head),
            // whose own continuation at x=2 (width 0) must be cleared.
            grid.setCell(new Point(0, 0), "界", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 2);

            const nextCont = grid.getCellAt(2, 0);
            expect(nextCont.char).toBe(" ");
            expect(nextCont.width).toBe(1);
        });
    });

    describe("updateCell wide characters", () => {
        it("sets up a continuation cell for a width-2 patch", () => {
            const grid = new Grid(new Size(4, 1));
            grid.updateCell(new Point(0, 0), { char: "好", width: 2 });

            expect(grid.getCellAt(0, 0).width).toBe(2);
            expect(grid.getCellAt(1, 0).width).toBe(0);
            expect(grid.getCellAt(1, 0).char).toBe("");
        });

        it("skips wide-char bookkeeping when neither char nor width is patched (line 120 false branch)", () => {
            const grid = new Grid(new Size(4, 1));
            grid.setCell(new Point(0, 0), "好", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 2);
            // Patch only fg — should not disturb the wide-char structure
            const red = packRgb(255, 0, 0);
            grid.updateCell(new Point(0, 0), { fg: red });

            expect(grid.getCellAt(0, 0).fg).toBe(red);
            expect(grid.getCellAt(0, 0).width).toBe(2);
            expect(grid.getCellAt(1, 0).width).toBe(0);
        });

        it("clears the head when overwriting a continuation cell (line 124 true branch)", () => {
            const grid = new Grid(new Size(4, 1));
            grid.setCell(new Point(0, 0), "好", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 2);
            grid.updateCell(new Point(1, 0), { char: "A", width: 1 });

            expect(grid.getCellAt(0, 0).char).toBe(" ");
            expect(grid.getCellAt(0, 0).width).toBe(1);
        });

        it("leaves the previous cell untouched when neighbour is not a wide head (line 124 false branch)", () => {
            const grid = new Grid(new Size(4, 1));
            grid.setCell(new Point(0, 0), "A", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 1);
            grid.updateCell(new Point(1, 0), { width: 0 });
            // cell.width===0, x>0, but head.width !== 2 → false branch
            grid.updateCell(new Point(1, 0), { char: "B", width: 1 });

            expect(grid.getCellAt(0, 0).char).toBe("A");
            expect(grid.getCellAt(1, 0).char).toBe("B");
        });

        it("clears the continuation when overwriting a wide head (line 132 true branch)", () => {
            const grid = new Grid(new Size(4, 1));
            grid.setCell(new Point(0, 0), "好", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 2);
            grid.updateCell(new Point(0, 0), { char: "A", width: 1 });

            expect(grid.getCellAt(1, 0).char).toBe(" ");
            expect(grid.getCellAt(1, 0).width).toBe(1);
        });

        it("clears a clobbered wide head's stale continuation when patching a new wide char (line 152 true branch)", () => {
            const grid = new Grid(new Size(5, 1));
            grid.setCell(new Point(1, 0), "好", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 2);
            grid.updateCell(new Point(0, 0), { char: "界", width: 2 });

            expect(grid.getCellAt(2, 0).char).toBe(" ");
            expect(grid.getCellAt(2, 0).width).toBe(1);
        });

        it("uses the existing cell width when width is not patched (line 146 fallback)", () => {
            const grid = new Grid(new Size(4, 1));
            grid.setCell(new Point(0, 0), "好", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None, 2);
            const blue = packRgb(0, 0, 255);
            // No width in patch: newWidth falls back to cell.width (2) and continuation is refreshed
            grid.updateCell(new Point(0, 0), { char: "界", fg: blue, bg: blue, style: StyleFlags.Bold });

            const cont = grid.getCellAt(1, 0);
            expect(cont.width).toBe(0);
            expect(cont.fg).toBe(blue);
            expect(cont.bg).toBe(blue);
        });
    });

    describe("cellEqualsAt / copyCellFrom", () => {
        it("cellEqualsAt reports equal and unequal cells", () => {
            const a = new Grid(new Size(3, 2));
            const b = new Grid(new Size(3, 2));
            expect(a.cellEqualsAt(1, 1, b)).toBe(true);
            b.setCell(new Point(1, 1), "X");
            expect(a.cellEqualsAt(1, 1, b)).toBe(false);
        });

        it("copyCellFrom copies a single cell", () => {
            const src = new Grid(new Size(3, 2));
            const dst = new Grid(new Size(3, 2));
            src.setCell(new Point(2, 1), "Z", packRgb(1, 2, 3));
            dst.copyCellFrom(2, 1, src);
            expect(dst.getCellAt(2, 1).char).toBe("Z");
        });

        it("copyAllCellsFrom copies the whole grid", () => {
            const src = new Grid(new Size(2, 2));
            const dst = new Grid(new Size(2, 2));
            src.setCell(new Point(0, 0), "P");
            src.setCell(new Point(1, 1), "Q");
            dst.copyAllCellsFrom(src);
            expect(dst.getCellAt(0, 0).char).toBe("P");
            expect(dst.getCellAt(1, 1).char).toBe("Q");
        });
    });

    describe("fill", () => {
        it("fills every cell with the given values", () => {
            const grid = new Grid(new Size(3, 2));
            const green = packRgb(0, 255, 0);
            grid.fill(".", green, DEFAULT_COLOR, StyleFlags.Dim);

            for (let y = 0; y < grid.height; y++) {
                for (let x = 0; x < grid.width; x++) {
                    const cell = grid.getCellAt(x, y);
                    expect(cell.char).toBe(".");
                    expect(cell.fg).toBe(green);
                    expect(cell.bg).toBe(DEFAULT_COLOR);
                    expect(cell.style).toBe(StyleFlags.Dim);
                }
            }
        });

        it("overwrites previously set cells", () => {
            const grid = new Grid(new Size(2, 2));
            grid.setCell(new Point(0, 0), "X", packRgb(255, 0, 0));
            grid.fill();

            expect(grid.getCell(new Point(0, 0)).char).toBe(" ");
            expect(grid.getCell(new Point(0, 0)).fg).toBe(DEFAULT_COLOR);
        });
    });
});
