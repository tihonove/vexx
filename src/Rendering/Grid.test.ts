import { describe, expect, it } from "vitest";
import { Grid } from "./Grid.ts";
import { DEFAULT_COLOR, packRgb } from "./ColorUtils.ts";
import { StyleFlags } from "./StyleFlags.ts";
import { Point, Size } from "../Common/GeometryPromitives.ts";

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
