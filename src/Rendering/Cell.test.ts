import { describe, expect, it } from "vitest";
import { Cell } from "./Cell.ts";
import { DEFAULT_COLOR, packRgb } from "./ColorUtils.ts";
import { StyleFlags } from "./StyleFlags.ts";

describe("Cell", () => {
    describe("constructor defaults", () => {
        it("creates an empty cell with space, default colors, no style", () => {
            const cell = new Cell();
            expect(cell.char).toBe(" ");
            expect(cell.fg).toBe(DEFAULT_COLOR);
            expect(cell.bg).toBe(DEFAULT_COLOR);
            expect(cell.style).toBe(StyleFlags.None);
        });

        it("accepts custom values", () => {
            const fg = packRgb(255, 0, 0);
            const bg = packRgb(0, 0, 255);
            const cell = new Cell("A", fg, bg, StyleFlags.Bold | StyleFlags.Italic);
            expect(cell.char).toBe("A");
            expect(cell.fg).toBe(fg);
            expect(cell.bg).toBe(bg);
            expect(cell.style).toBe(StyleFlags.Bold | StyleFlags.Italic);
        });
    });

    describe("Cell.empty()", () => {
        it("returns a fresh empty cell each time", () => {
            const a = Cell.empty();
            const b = Cell.empty();
            expect(a).not.toBe(b);
            expect(a.char).toBe(" ");
        });
    });

    describe("equals", () => {
        it("returns true for cells with identical fields", () => {
            const a = new Cell("X", packRgb(1, 2, 3), packRgb(4, 5, 6), StyleFlags.Bold);
            const b = new Cell("X", packRgb(1, 2, 3), packRgb(4, 5, 6), StyleFlags.Bold);
            expect(a.equals(b)).toBe(true);
        });

        it("returns false when char differs", () => {
            const a = new Cell("A");
            const b = new Cell("B");
            expect(a.equals(b)).toBe(false);
        });

        it("returns false when fg differs", () => {
            const a = new Cell(" ", packRgb(255, 0, 0));
            const b = new Cell(" ", packRgb(0, 255, 0));
            expect(a.equals(b)).toBe(false);
        });

        it("returns false when bg differs", () => {
            const a = new Cell(" ", DEFAULT_COLOR, packRgb(0, 0, 0));
            const b = new Cell(" ", DEFAULT_COLOR, packRgb(0, 0, 1));
            expect(a.equals(b)).toBe(false);
        });

        it("returns false when style differs", () => {
            const a = new Cell(" ", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.Bold);
            const b = new Cell(" ", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.Italic);
            expect(a.equals(b)).toBe(false);
        });
    });

    describe("copyFrom", () => {
        it("copies all fields from source cell", () => {
            const src = new Cell("Z", packRgb(10, 20, 30), packRgb(40, 50, 60), StyleFlags.Underline);
            const dst = Cell.empty();
            dst.copyFrom(src);

            expect(dst.char).toBe("Z");
            expect(dst.fg).toBe(src.fg);
            expect(dst.bg).toBe(src.bg);
            expect(dst.style).toBe(src.style);
        });

        it("does not create a reference — mutating source after copy does not affect destination", () => {
            const src = new Cell("A");
            const dst = Cell.empty();
            dst.copyFrom(src);
            src.char = "B";
            expect(dst.char).toBe("A");
        });
    });
});
