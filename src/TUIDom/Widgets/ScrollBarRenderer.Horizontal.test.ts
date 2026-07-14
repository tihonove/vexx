import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../vs/tui/backend/mockTerminalBackend.ts";
import { Point, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../vs/tui/rendering/colorUtils.ts";
import { TerminalScreen } from "../../vs/tui/rendering/terminalScreen.ts";
import { RenderContext } from "../TUIElement.ts";

import { renderHorizontalScrollBar } from "./ScrollBarRenderer.ts";

const THUMB_COLOR = packRgb(100, 100, 100);
const TRACK_COLOR = packRgb(50, 50, 50);

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
            renderHorizontalScrollBar(ctx, 0, 6, 8, 0, 10);
        }, 6);

        expect(backend.getTextAt(new Point(0, 0), 6)).toBe("▀▀▀▀▀▀");
        for (let x = 0; x < 6; x++) {
            expect(backend.getFgAt(new Point(x, 0))).toBe(THUMB_COLOR);
        }
    });

    it("draws a partial thumb over the track when content overflows the viewport", () => {
        const backend = render((ctx) => {
            // contentWidth (40) > viewportWidth (10): thumb covers a sub-range.
            renderHorizontalScrollBar(ctx, 0, 8, 40, 0, 10);
        }, 8);

        // Some cells are thumb-coloured, some are track-coloured (not a uniform bar).
        const colors = new Set<number>();
        for (let x = 0; x < 8; x++) {
            colors.add(backend.getFgAt(new Point(x, 0)));
        }
        expect(colors.has(THUMB_COLOR)).toBe(true);
        expect(colors.has(TRACK_COLOR)).toBe(true);
    });
});
