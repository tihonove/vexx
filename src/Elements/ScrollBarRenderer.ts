import { Point } from "../Common/GeometryPromitives.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";

import type { RenderContext } from "./TUIElement.ts";

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
    const { dx: ox, dy: oy } = context.offset;

    for (let row = 0; row < trackHeight; row++) {
        const char = chars[row];
        // fg-only rendering: thumb uses THUMB_COLOR, track uses TRACK_COLOR.
        // Background is always DEFAULT — no custom bg, no bleed.
        const fg = char === "░" ? TRACK_COLOR : THUMB_COLOR;
        context.canvas.setCell(new Point(ox + x, oy + row), { char, fg });
    }
}
