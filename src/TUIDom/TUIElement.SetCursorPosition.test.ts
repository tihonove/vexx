import { describe, expect, it } from "vitest";

import { Offset, Point, Rect, Size } from "../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../vs/tui/rendering/terminalScreen.ts";

import { RenderContext } from "./TUIElement.ts";

describe("RenderContext.setCursorPosition — clipping", () => {
    it("places the cursor when the point is inside the clip rect", () => {
        const screen = new TerminalScreen(new Size(10, 5));
        const ctx = new RenderContext(screen, new Offset(0, 0), new Rect(new Point(0, 0), new Size(4, 4)));

        ctx.setCursorPosition(1, 2);

        expect(screen.cursorPosition).toEqual(new Point(1, 2));
    });

    it("ignores the cursor when the point lies outside the clip rect", () => {
        const screen = new TerminalScreen(new Size(10, 5));
        const ctx = new RenderContext(screen, new Offset(0, 0), new Rect(new Point(0, 0), new Size(2, 2)));

        ctx.setCursorPosition(5, 5);

        expect(screen.cursorPosition).toBeNull();
    });

    it("applies the context offset before testing the clip", () => {
        const screen = new TerminalScreen(new Size(10, 5));
        // Clip covers screen columns/rows [2, 6); with an offset of (2, 2) the
        // local point (0, 0) maps to screen (2, 2), which is just inside the clip.
        const ctx = new RenderContext(screen, new Offset(2, 2), new Rect(new Point(2, 2), new Size(4, 4)));

        ctx.setCursorPosition(0, 0);

        expect(screen.cursorPosition).toEqual(new Point(2, 2));
    });
});
