import { describe, expect, it } from "vitest";

import { Point, Rect, Size } from "./GeometryPromitives.ts";

describe("Rect", () => {
    describe("containsPoint", () => {
        const rect = new Rect(new Point(10, 20), new Size(30, 40));

        it("returns true for point inside", () => {
            expect(rect.containsPoint(new Point(15, 30))).toBe(true);
        });

        it("returns true for top-left corner (inclusive)", () => {
            expect(rect.containsPoint(new Point(10, 20))).toBe(true);
        });

        it("returns false for bottom-right corner (exclusive)", () => {
            expect(rect.containsPoint(new Point(40, 60))).toBe(false);
        });

        it("returns false for point to the left", () => {
            expect(rect.containsPoint(new Point(9, 30))).toBe(false);
        });

        it("returns false for point above", () => {
            expect(rect.containsPoint(new Point(15, 19))).toBe(false);
        });

        it("returns false for point to the right", () => {
            expect(rect.containsPoint(new Point(40, 30))).toBe(false);
        });

        it("returns false for point below", () => {
            expect(rect.containsPoint(new Point(15, 60))).toBe(false);
        });
    });

    describe("intersect", () => {
        it("returns overlap of two overlapping rects", () => {
            const a = new Rect(new Point(0, 0), new Size(10, 10));
            const b = new Rect(new Point(5, 5), new Size(10, 10));
            const result = a.intersect(b);

            expect(result.x).toBe(5);
            expect(result.y).toBe(5);
            expect(result.width).toBe(5);
            expect(result.height).toBe(5);
        });

        it("returns empty rect for non-overlapping rects", () => {
            const a = new Rect(new Point(0, 0), new Size(5, 5));
            const b = new Rect(new Point(10, 10), new Size(5, 5));
            const result = a.intersect(b);

            expect(result.isEmpty).toBe(true);
        });

        it("returns smaller rect when one contains another", () => {
            const outer = new Rect(new Point(0, 0), new Size(100, 100));
            const inner = new Rect(new Point(10, 20), new Size(30, 40));
            const result = outer.intersect(inner);

            expect(result.x).toBe(10);
            expect(result.y).toBe(20);
            expect(result.width).toBe(30);
            expect(result.height).toBe(40);
        });

        it("returns empty rect for adjacent rects (no overlap)", () => {
            const a = new Rect(new Point(0, 0), new Size(5, 5));
            const b = new Rect(new Point(5, 0), new Size(5, 5));
            const result = a.intersect(b);

            expect(result.isEmpty).toBe(true);
        });
    });

    describe("isEmpty", () => {
        it("returns false for non-empty rect", () => {
            expect(new Rect(new Point(0, 0), new Size(10, 10)).isEmpty).toBe(false);
        });

        it("returns true for zero-width rect", () => {
            expect(new Rect(new Point(0, 0), new Size(0, 10)).isEmpty).toBe(true);
        });

        it("returns true for zero-height rect", () => {
            expect(new Rect(new Point(0, 0), new Size(10, 0)).isEmpty).toBe(true);
        });
    });

    describe("right and bottom", () => {
        it("computes right and bottom correctly", () => {
            const rect = new Rect(new Point(5, 10), new Size(20, 30));
            expect(rect.right).toBe(25);
            expect(rect.bottom).toBe(40);
        });
    });
});
