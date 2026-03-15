import { describe, expect, it } from "vitest";

import { computeScrollBarMetrics, getScrollBarCellChars } from "./ScrollBarRenderer.ts";

describe("ScrollBarRenderer", () => {
    describe("computeScrollBarMetrics", () => {
        it("returns full track when content fits viewport", () => {
            const metrics = computeScrollBarMetrics(10, 10, 0, 10);
            expect(metrics.thumbStartEighths).toBe(0);
            expect(metrics.thumbSizeEighths).toBe(80); // 10 * 8
        });

        it("returns full track when content smaller than viewport", () => {
            const metrics = computeScrollBarMetrics(10, 5, 0, 10);
            expect(metrics.thumbStartEighths).toBe(0);
            expect(metrics.thumbSizeEighths).toBe(80);
        });

        it("thumb at top when scrollTop is 0", () => {
            const metrics = computeScrollBarMetrics(10, 100, 0, 10);
            expect(metrics.thumbStartEighths).toBe(0);
            expect(metrics.thumbSizeEighths).toBe(8); // min thumb size = 1 cell = 8 eighths
        });

        it("thumb at bottom when scrolled to end", () => {
            const metrics = computeScrollBarMetrics(10, 100, 90, 10);
            expect(metrics.thumbStartEighths).toBe(72); // 80 - 8
            expect(metrics.thumbSizeEighths).toBe(8);
        });

        it("thumb in middle when scrolled halfway", () => {
            const metrics = computeScrollBarMetrics(10, 100, 45, 10);
            expect(metrics.thumbStartEighths).toBe(36); // 0.5 * (80 - 8) = 36
            expect(metrics.thumbSizeEighths).toBe(8);
        });

        it("thumb size proportional to viewport/content ratio", () => {
            // viewport = 50% of content → thumb ≈ 50% of track
            const metrics = computeScrollBarMetrics(10, 20, 0, 10);
            expect(metrics.thumbSizeEighths).toBe(40); // 10/20 * 80 = 40
        });

        it("clamps scrollTop to valid range", () => {
            const metrics = computeScrollBarMetrics(10, 100, 200, 10);
            // scrollFraction clamped to 1.0
            expect(metrics.thumbStartEighths).toBe(72);
        });
    });

    describe("getScrollBarCellChars", () => {
        it("full track when content fits", () => {
            const metrics = computeScrollBarMetrics(5, 5, 0, 5);
            const chars = getScrollBarCellChars(5, metrics);
            expect(chars).toEqual(["█", "█", "█", "█", "█"]);
        });

        it("thumb at top of track", () => {
            const metrics = { thumbStartEighths: 0, thumbSizeEighths: 16 };
            const chars = getScrollBarCellChars(5, metrics);
            // rows 0-1 are full thumb, rows 2-4 are track
            expect(chars).toEqual(["█", "█", "░", "░", "░"]);
        });

        it("thumb at bottom of track", () => {
            const metrics = { thumbStartEighths: 24, thumbSizeEighths: 16 };
            const chars = getScrollBarCellChars(5, metrics);
            // rows 0-2 track, rows 3-4 thumb
            expect(chars).toEqual(["░", "░", "░", "█", "█"]);
        });

        it("partial block at thumb start", () => {
            // Thumb starts at 4/8 into cell 0 → bottom 4/8 filled
            const metrics = { thumbStartEighths: 4, thumbSizeEighths: 16 };
            const chars = getScrollBarCellChars(5, metrics);
            expect(chars[0]).toBe("▄"); // 4/8 from bottom
            expect(chars[1]).toBe("█"); // full
            expect(chars[2]).toBe("▄"); // 4/8 from bottom (thumb ends at 20, cell 2 starts at 16, 20-16=4)
            expect(chars[3]).toBe("░");
            expect(chars[4]).toBe("░");
        });

        it("partial block at thumb end", () => {
            // Thumb from 0 to 12 eighths (1.5 cells)
            const metrics = { thumbStartEighths: 0, thumbSizeEighths: 12 };
            const chars = getScrollBarCellChars(5, metrics);
            expect(chars[0]).toBe("█"); // full
            expect(chars[1]).toBe("▄"); // 12 - 8 = 4/8 from bottom
            expect(chars[2]).toBe("░");
        });

        it("small partial blocks", () => {
            // Thumb starts at 1/8 into cell 0
            const metrics = { thumbStartEighths: 1, thumbSizeEighths: 8 };
            const chars = getScrollBarCellChars(3, metrics);
            expect(chars[0]).toBe("▇"); // 8 - 1 = 7/8 from bottom (thumb)
            expect(chars[1]).toBe("▇"); // 16 - 9 = 7/8 from bottom (track)
            expect(chars[2]).toBe("░");
        });

        it("various sub-character positions", () => {
            // Thumb starts at 2/8 → ▆ (6/8 thumb from bottom)
            // Thumb ends at 10/8 → cell 1: 16-10 = 6/8 track from bottom → ▆
            const metrics = { thumbStartEighths: 2, thumbSizeEighths: 8 };
            const chars = getScrollBarCellChars(3, metrics);
            expect(chars[0]).toBe("▆");
            expect(chars[1]).toBe("▆");
            expect(chars[2]).toBe("░");
        });
    });
});
