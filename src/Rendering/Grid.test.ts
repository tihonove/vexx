import { describe, expect, it } from "vitest";
import { Grid } from "./Grid.ts";
import { DEFAULT_COLOR, packRgb } from "./ColorUtils.ts";
import { StyleFlags } from "./StyleFlags.ts";

describe("Grid", () => {
    describe("constructor", () => {
        it("creates grid with given dimensions", () => {
            const grid = new Grid(10, 5);
            expect(grid.width).toBe(10);
            expect(grid.height).toBe(5);
        });

        it("allocates width × height cells", () => {
            const grid = new Grid(4, 3);
            expect(grid.cells).toHaveLength(12);
        });

        it("initializes all cells as empty spaces", () => {
            const grid = new Grid(3, 2);
            for (const cell of grid.cells) {
                expect(cell.char).toBe(" ");
                expect(cell.fg).toBe(DEFAULT_COLOR);
                expect(cell.bg).toBe(DEFAULT_COLOR);
                expect(cell.style).toBe(StyleFlags.None);
            }
        });
    });

    describe("getCell", () => {
        it("returns the cell at (x, y) from the flat array", () => {
            const grid = new Grid(5, 3);
            // Manually mutate cell at flat index for (2, 1): index = 1*5 + 2 = 7
            grid.cells[7].char = "X";
            expect(grid.getCell(2, 1).char).toBe("X");
        });

        it("returns a direct reference — mutations propagate", () => {
            const grid = new Grid(3, 3);
            const cell = grid.getCell(1, 2);
            cell.char = "!";
            expect(grid.getCell(1, 2).char).toBe("!");
        });
    });

    describe("setCell", () => {
        it("sets char, fg, bg, style on the cell at (x, y)", () => {
            const grid = new Grid(4, 4);
            const red = packRgb(255, 0, 0);
            const blue = packRgb(0, 0, 255);
            grid.setCell(2, 3, "A", red, blue, StyleFlags.Bold);

            const cell = grid.getCell(2, 3);
            expect(cell.char).toBe("A");
            expect(cell.fg).toBe(red);
            expect(cell.bg).toBe(blue);
            expect(cell.style).toBe(StyleFlags.Bold);
        });

        it("defaults fg/bg to DEFAULT_COLOR and style to None", () => {
            const grid = new Grid(2, 2);
            grid.setCell(0, 0, "B");

            const cell = grid.getCell(0, 0);
            expect(cell.char).toBe("B");
            expect(cell.fg).toBe(DEFAULT_COLOR);
            expect(cell.bg).toBe(DEFAULT_COLOR);
            expect(cell.style).toBe(StyleFlags.None);
        });
    });

    describe("fill", () => {
        it("fills every cell with the given values", () => {
            const grid = new Grid(3, 2);
            const green = packRgb(0, 255, 0);
            grid.fill(".", green, DEFAULT_COLOR, StyleFlags.Dim);

            for (const cell of grid.cells) {
                expect(cell.char).toBe(".");
                expect(cell.fg).toBe(green);
                expect(cell.bg).toBe(DEFAULT_COLOR);
                expect(cell.style).toBe(StyleFlags.Dim);
            }
        });

        it("overwrites previously set cells", () => {
            const grid = new Grid(2, 2);
            grid.setCell(0, 0, "X", packRgb(255, 0, 0));
            grid.fill();

            expect(grid.getCell(0, 0).char).toBe(" ");
            expect(grid.getCell(0, 0).fg).toBe(DEFAULT_COLOR);
        });
    });
});
