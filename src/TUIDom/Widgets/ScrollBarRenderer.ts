import { packRgb } from "../../Rendering/ColorUtils.ts";
import type { RenderContext } from "../TUIElement.ts";

const THUMB_COLOR = packRgb(100, 100, 100);
const TRACK_COLOR = packRgb(50, 50, 50);

export interface ScrollBarMetrics {
    /** Thumb start position in half-cell units (0 = top of track). */
    thumbStartHalves: number;
    /** Thumb size in half-cell units (minimum 2 = 1 full cell). */
    thumbSizeHalves: number;
}

export function computeScrollBarMetrics(
    trackHeight: number,
    contentHeight: number,
    scrollTop: number,
    viewportHeight: number,
): ScrollBarMetrics {
    const trackHalves = trackHeight * 2;

    if (contentHeight <= viewportHeight) {
        return { thumbStartHalves: 0, thumbSizeHalves: trackHalves };
    }

    const thumbSizeHalves = Math.max(2, Math.round((viewportHeight / contentHeight) * trackHalves));
    const maxScroll = contentHeight - viewportHeight;
    const scrollFraction = Math.min(1, Math.max(0, scrollTop / maxScroll));
    const thumbStartHalves = Math.round(scrollFraction * (trackHalves - thumbSizeHalves));

    return { thumbStartHalves, thumbSizeHalves };
}

/**
 * For each cell row, determine the character to display.
 *
 * Each cell covers 2 halves: top half and bottom half.
 * - Both halves inside thumb → "█"
 * - Only top half inside thumb → "▀"
 * - Only bottom half inside thumb → "▄"
 * - Neither half inside thumb → " "
 */
export function getScrollBarCellChars(trackHeight: number, metrics: ScrollBarMetrics): string[] {
    const { thumbStartHalves, thumbSizeHalves } = metrics;
    const thumbEndHalves = thumbStartHalves + thumbSizeHalves;
    const result: string[] = [];

    for (let row = 0; row < trackHeight; row++) {
        const topHalf = row * 2;
        const bottomHalf = topHalf + 1;

        const topInThumb = topHalf >= thumbStartHalves && topHalf < thumbEndHalves;
        const bottomInThumb = bottomHalf >= thumbStartHalves && bottomHalf < thumbEndHalves;

        if (topInThumb && bottomInThumb) {
            result.push("█");
        } else if (topInThumb) {
            result.push("▀");
        } else if (bottomInThumb) {
            result.push("▄");
        } else {
            result.push("░");
        }
    }

    return result;
}

export function renderScrollBar(
    context: RenderContext,
    x: number,
    trackHeight: number,
    contentHeight: number,
    scrollTop: number,
    viewportHeight: number,
): void {
    const metrics = computeScrollBarMetrics(trackHeight, contentHeight, scrollTop, viewportHeight);
    const chars = getScrollBarCellChars(trackHeight, metrics);

    for (let row = 0; row < trackHeight; row++) {
        const char = chars[row];
        // fg-only rendering: thumb uses THUMB_COLOR, track uses TRACK_COLOR.
        // Background is always DEFAULT — no custom bg, no bleed.
        const fg = char === "░" ? TRACK_COLOR : THUMB_COLOR;
        context.setCell(x, row, { char, fg });
    }
}

export function renderHorizontalScrollBar(
    context: RenderContext,
    y: number,
    trackWidth: number,
    contentWidth: number,
    scrollLeft: number,
    viewportWidth: number,
): void {
    if (contentWidth <= viewportWidth) {
        for (let col = 0; col < trackWidth; col++) {
            context.setCell(col, y, { char: "▀", fg: THUMB_COLOR });
        }
        return;
    }

    const thumbSize = Math.max(1, Math.round((viewportWidth / contentWidth) * trackWidth));
    const maxScroll = contentWidth - viewportWidth;
    const scrollFraction = Math.min(1, Math.max(0, scrollLeft / maxScroll));
    const thumbStart = Math.round(scrollFraction * (trackWidth - thumbSize));
    const thumbEnd = thumbStart + thumbSize;

    for (let col = 0; col < trackWidth; col++) {
        const inThumb = col >= thumbStart && col < thumbEnd;
        context.setCell(col, y, { char: "▀", fg: inThumb ? THUMB_COLOR : TRACK_COLOR });
    }
}
