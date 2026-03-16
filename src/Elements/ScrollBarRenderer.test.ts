import { describe, expect, it } from "vitest";

import { computeScrollBarMetrics, getScrollBarCellChars } from "./ScrollBarRenderer.ts";

describe("ScrollBarRenderer", () => {
    describe("computeScrollBarMetrics", () => {
        it("returns full track when content fits viewport", () => {
            const metrics = computeScrollBarMetrics(10, 10, 0, 10);
            expect(metrics.thumbStartHalves).toBe(0);
            expect(metrics.thumbSizeHalves).toBe(20); // 10 * 2
        });

        it("returns full track when content smaller than viewport", () => {
            const metrics = computeScrollBarMetrics(10, 5, 0, 10);
            expect(metrics.thumbStartHalves).toBe(0);
            expect(metrics.thumbSizeHalves).toBe(20);
        });

        it("thumb at top when scrollTop is 0", () => {
            const metrics = computeScrollBarMetrics(10, 100, 0, 10);
            expect(metrics.thumbStartHalves).toBe(0);
            expect(metrics.thumbSizeHalves).toBe(2); // min thumb size = 1 cell = 2 halves
        });

        it("thumb at bottom when scrolled to end", () => {
            const metrics = computeScrollBarMetrics(10, 100, 90, 10);
            expect(metrics.thumbStartHalves).toBe(18); // 20 - 2
            expect(metrics.thumbSizeHalves).toBe(2);
        });

        it("thumb in middle when scrolled halfway", () => {
            const metrics = computeScrollBarMetrics(10, 100, 45, 10);
            expect(metrics.thumbStartHalves).toBe(9); // 0.5 * (20 - 2) = 9
            expect(metrics.thumbSizeHalves).toBe(2);
        });

        it("thumb size proportional to viewport/content ratio", () => {
            // viewport = 50% of content → thumb ≈ 50% of track
            const metrics = computeScrollBarMetrics(10, 20, 0, 10);
            expect(metrics.thumbSizeHalves).toBe(10); // 10/20 * 20 = 10
        });

        it("clamps scrollTop to valid range", () => {
            const metrics = computeScrollBarMetrics(10, 100, 200, 10);
            // scrollFraction clamped to 1.0
            expect(metrics.thumbStartHalves).toBe(18);
        });
    });

    describe("getScrollBarCellChars", () => {
        it("full track when content fits", () => {
            const metrics = computeScrollBarMetrics(5, 5, 0, 5);
            const chars = getScrollBarCellChars(5, metrics);
            expect(chars).toEqual(["█", "█", "█", "█", "█"]);
        });

        it("thumb at top of track", () => {
            const metrics = { thumbStartHalves: 0, thumbSizeHalves: 4 };
            const chars = getScrollBarCellChars(5, metrics);
            // rows 0-1 full thumb, rows 2-4 track
            expect(chars).toEqual(["█", "█", "░", "░", "░"]);
        });

        it("thumb at bottom of track", () => {
            const metrics = { thumbStartHalves: 6, thumbSizeHalves: 4 };
            const chars = getScrollBarCellChars(5, metrics);
            // rows 0-2 empty, rows 3-4 full thumb
            expect(chars).toEqual(["░", "░", "░", "█", "█"]);
        });

        it("half block at thumb start (bottom half)", () => {
            // Thumb starts at half 1 (bottom half of cell 0)
            const metrics = { thumbStartHalves: 1, thumbSizeHalves: 4 };
            const chars = getScrollBarCellChars(5, metrics);
            expect(chars[0]).toBe("▄"); // bottom half = thumb
            expect(chars[1]).toBe("█"); // both halves = thumb
            expect(chars[2]).toBe("▀"); // top half = thumb (half 4), bottom (half 5) out
            expect(chars[3]).toBe("░");
            expect(chars[4]).toBe("░");
        });

        it("half block at thumb end (top half)", () => {
            // Thumb from 0 to 3 halves (1.5 cells)
            const metrics = { thumbStartHalves: 0, thumbSizeHalves: 3 };
            const chars = getScrollBarCellChars(5, metrics);
            expect(chars[0]).toBe("█"); // full
            expect(chars[1]).toBe("▀"); // top half only
            expect(chars[2]).toBe("░");
        });

        it("single bottom-half thumb", () => {
            // Thumb is exactly 1 half, starting at bottom of cell 1
            const metrics = { thumbStartHalves: 3, thumbSizeHalves: 2 };
            const chars = getScrollBarCellChars(3, metrics);
            expect(chars[0]).toBe("░");
            expect(chars[1]).toBe("▄"); // bottom half = thumb
            expect(chars[2]).toBe("▀"); // top half = thumb
        });
    });
});
