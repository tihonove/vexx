import { Point } from "../Common/GeometryPromitives.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import type { RenderContext } from "./TUIElement.ts";

// ▁▂▃▄▅▆▇█ — lower block elements (1/8 to 8/8 filled from bottom)
const LOWER_BLOCKS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

const TRACK_CHAR = "░";

const THUMB_FG = packRgb(120, 120, 120);
const THUMB_BG = packRgb(60, 60, 60);
const TRACK_FG = packRgb(60, 60, 60);
const TRACK_BG = packRgb(30, 30, 30);

export interface ScrollBarMetrics {
    thumbStartEighths: number;
    thumbSizeEighths: number;
}

export function computeScrollBarMetrics(
    trackHeight: number,
    contentHeight: number,
    scrollTop: number,
    viewportHeight: number,
): ScrollBarMetrics {
    const trackEighths = trackHeight * 8;

    if (contentHeight <= viewportHeight) {
        return { thumbStartEighths: 0, thumbSizeEighths: trackEighths };
    }

    const thumbSizeEighths = Math.max(8, Math.round((viewportHeight / contentHeight) * trackEighths));
    const maxScroll = contentHeight - viewportHeight;
    const scrollFraction = Math.min(1, Math.max(0, scrollTop / maxScroll));
    const thumbStartEighths = Math.round(scrollFraction * (trackEighths - thumbSizeEighths));

    return { thumbStartEighths, thumbSizeEighths };
}

export function getScrollBarCellChars(trackHeight: number, metrics: ScrollBarMetrics): string[] {
    const { thumbStartEighths, thumbSizeEighths } = metrics;
    const thumbEndEighths = thumbStartEighths + thumbSizeEighths;
    const result: string[] = [];

    for (let row = 0; row < trackHeight; row++) {
        const cellTopEighths = row * 8;
        const cellBottomEighths = cellTopEighths + 8;

        if (cellBottomEighths <= thumbStartEighths || cellTopEighths >= thumbEndEighths) {
            result.push(TRACK_CHAR);
        } else if (cellTopEighths >= thumbStartEighths && cellBottomEighths <= thumbEndEighths) {
            result.push(LOWER_BLOCKS[8]);
        } else if (cellTopEighths < thumbStartEighths) {
            // Thumb starts partway through this cell
            const filledFromBottom = cellBottomEighths - thumbStartEighths;
            result.push(LOWER_BLOCKS[filledFromBottom]);
        } else {
            // Thumb ends partway through this cell — bottom part is track
            const trackFromBottom = cellBottomEighths - thumbEndEighths;
            result.push(LOWER_BLOCKS[trackFromBottom]);
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
    const { thumbStartEighths, thumbSizeEighths } = metrics;
    const thumbEndEighths = thumbStartEighths + thumbSizeEighths;
    const { dx: ox, dy: oy } = context.offset;

    for (let row = 0; row < trackHeight; row++) {
        const cellTopEighths = row * 8;
        const cellBottomEighths = cellTopEighths + 8;
        const char = chars[row];

        let fg: number;
        let bg: number;

        if (cellBottomEighths <= thumbStartEighths || cellTopEighths >= thumbEndEighths) {
            fg = TRACK_FG;
            bg = TRACK_BG;
        } else if (cellTopEighths >= thumbStartEighths && cellBottomEighths <= thumbEndEighths) {
            fg = THUMB_FG;
            bg = THUMB_FG;
        } else if (cellTopEighths < thumbStartEighths) {
            // Thumb starts partway — lower block filled from bottom = thumb color, top = track
            fg = THUMB_FG;
            bg = TRACK_BG;
        } else {
            // Thumb ends partway — lower block filled from bottom = track color on top of thumb
            fg = TRACK_BG;
            bg = THUMB_FG;
        }

        context.canvas.setCell(new Point(ox + x, oy + row), { char, fg, bg });
    }
}
