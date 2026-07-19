import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../../../tui/backend/mockTerminalBackend.ts";
import { Point, Size } from "../../../common/geometryPromitives.ts";
import { packRgb } from "../../../common/colorUtils.ts";
import { TerminalScreen } from "../../../../tui/rendering/terminalScreen.ts";
import { RenderContext } from "../../tuiElement.ts";

import type { ScrollBarColors } from "./scrollBarRenderer.ts";
import { renderHorizontalScrollBar } from "./scrollBarRenderer.ts";

const THUMB_COLOR = packRgb(100, 100, 100);
const TRACK_COLOR = packRgb(50, 50, 50);
const BACKGROUND_COLOR = packRgb(31, 31, 31);

const COLORS: ScrollBarColors = { thumb: THUMB_COLOR, track: TRACK_COLOR, background: BACKGROUND_COLOR };

function render(fn: (ctx: RenderContext) => void, width: number): MockTerminalBackend {
    const size = new Size(width, 1);
    const screen = new TerminalScreen(size);
    const backend = new MockTerminalBackend(size);
    fn(new RenderContext(screen));
    screen.flush(backend);
    return backend;
}

describe("renderHorizontalScrollBar", () => {
    it("fills the whole track with a thumb-coloured bar when content fits the viewport", () => {
        const backend = render((ctx) => {
            // contentWidth (8) <= viewportWidth (10) → the early full-bar branch.
            renderHorizontalScrollBar(ctx, 0, 6, 8, 0, 10, COLORS);
        }, 6);

        expect(backend.getTextAt(new Point(0, 0), 6)).toBe("▄▄▄▄▄▄");
        for (let x = 0; x < 6; x++) {
            expect(backend.getFgAt(new Point(x, 0))).toBe(THUMB_COLOR);
        }
    });

    it("draws a partial thumb over the track when content overflows the viewport", () => {
        const backend = render((ctx) => {
            // contentWidth (40) > viewportWidth (10): thumb covers a sub-range.
            renderHorizontalScrollBar(ctx, 0, 8, 40, 0, 10, COLORS);
        }, 8);

        // Some cells are thumb-coloured, some are track-coloured (not a uniform bar).
        const colors = new Set<number>();
        for (let x = 0; x < 8; x++) {
            colors.add(backend.getFgAt(new Point(x, 0)));
        }
        expect(colors.has(THUMB_COLOR)).toBe(true);
        expect(colors.has(TRACK_COLOR)).toBe(true);
    });

    it("uses the LOWER half block so the bar sits on the bottom edge of the row", () => {
        const backend = render((ctx) => {
            renderHorizontalScrollBar(ctx, 0, 8, 40, 0, 10, COLORS);
        }, 8);

        // "▀" would float the bar a half-cell above the widget's bottom edge.
        expect(backend.getTextAt(new Point(0, 0), 8)).toBe("▄▄▄▄▄▄▄▄");
    });

    it("paints the background on every cell so the terminal default cannot bleed through", () => {
        const backend = render((ctx) => {
            renderHorizontalScrollBar(ctx, 0, 8, 40, 0, 10, COLORS);
        }, 8);

        // The bar owns a dedicated row the child never draws into. Grid.updateCell is a
        // patch, so omitting bg leaves TerminalScreen.clear()'s DEFAULT_COLOR and the row
        // reads as a hole punched through the widget.
        for (let x = 0; x < 8; x++) {
            expect(backend.getBgAt(new Point(x, 0))).toBe(BACKGROUND_COLOR);
        }
    });

    it("paints the background on the content-fits branch too", () => {
        const backend = render((ctx) => {
            renderHorizontalScrollBar(ctx, 0, 6, 8, 0, 10, COLORS);
        }, 6);

        for (let x = 0; x < 6; x++) {
            expect(backend.getBgAt(new Point(x, 0))).toBe(BACKGROUND_COLOR);
        }
    });
});
