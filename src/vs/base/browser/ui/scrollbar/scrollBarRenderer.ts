import type { RenderContext } from "../../tuiElement.ts";

/**
 * Resolved scrollbar colours. `background` fills the half of each cell the bar
 * itself does not paint — the scrollbar lives on a dedicated row/column that the
 * child never draws into, so without it those cells keep the terminal's default
 * background and the bar looks like a hole punched through the widget.
 */
export interface ScrollBarColors {
    readonly thumb: number;
    readonly track: number;
    readonly background: number;
}

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
    colors: ScrollBarColors,
): void {
    const metrics = computeScrollBarMetrics(trackHeight, contentHeight, scrollTop, viewportHeight);
    const chars = getScrollBarCellChars(trackHeight, metrics);

    for (let row = 0; row < trackHeight; row++) {
        const char = chars[row];
        const fg = char === "░" ? colors.track : colors.thumb;
        context.setCell(x, row, { char, fg, bg: colors.background });
    }
}

/**
 * Horizontal bar on its own row. Uses "▄" (LOWER half block) so the bar sits on
 * the bottom edge of the row, hugging the widget's frame rather than floating a
 * half-cell above it.
 */
export function renderHorizontalScrollBar(
    context: RenderContext,
    y: number,
    trackWidth: number,
    contentWidth: number,
    scrollLeft: number,
    viewportWidth: number,
    colors: ScrollBarColors,
): void {
    if (contentWidth <= viewportWidth) {
        // Content fits — only reachable under policy "always"; the thumb spans the track.
        for (let col = 0; col < trackWidth; col++) {
            context.setCell(col, y, { char: "▄", fg: colors.thumb, bg: colors.background });
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
        context.setCell(col, y, { char: "▄", fg: inThumb ? colors.thumb : colors.track, bg: colors.background });
    }
}
