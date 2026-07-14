import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../tui/backend/mockTerminalBackend.ts";
import { Point, Size } from "../common/geometry.ts";
import { TerminalScreen } from "../../tui/rendering/terminalScreen.ts";

import { RenderContext } from "./tuiElement.ts";

describe("RenderContext.drawText — wide-char clamping", () => {
    it("replaces a wide char with a single space when only one column fits at the right edge", () => {
        const size = new Size(3, 1);
        const screen = new TerminalScreen(size);
        const backend = new MockTerminalBackend(size);
        const ctx = new RenderContext(screen);

        // "世界" is two wide (2-column) chars = 4 display columns.
        // With maxWidth 3: 世 fits at cols 0-1, then 界 has only col 2 left → clamped to a space.
        const written = ctx.drawText(0, 0, "世界", undefined, { maxWidth: 3 });
        screen.flush(backend);

        // 世 occupies columns 0 (and its continuation 1).
        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("世");
        // The clamped wide char at column 2 becomes a plain space, not 界.
        expect(backend.getTextAt(new Point(2, 0), 1)).toBe(" ");
        // drawText returns the number of display columns consumed.
        expect(written).toBe(3);
    });

    it("renders a full wide char when both of its columns fit", () => {
        const size = new Size(4, 1);
        const screen = new TerminalScreen(size);
        const backend = new MockTerminalBackend(size);
        const ctx = new RenderContext(screen);

        const written = ctx.drawText(0, 0, "世界", undefined, { maxWidth: 4 });
        screen.flush(backend);

        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("世");
        expect(backend.getTextAt(new Point(2, 0), 1)).toBe("界");
        expect(written).toBe(4);
    });

    it("applies per-offset style overrides via getStyle", () => {
        const size = new Size(3, 1);
        const screen = new TerminalScreen(size);
        const backend = new MockTerminalBackend(size);
        const ctx = new RenderContext(screen);

        ctx.drawText(
            0,
            0,
            "abc",
            { fg: 1, bg: 2 },
            {
                getStyle: (offset) => (offset === 1 ? { fg: 99 } : undefined),
            },
        );
        screen.flush(backend);

        // The per-offset override only changes 'b' (offset 1) fg; others keep base fg.
        expect(backend.getFgAt(new Point(0, 0))).toBe(1);
        expect(backend.getFgAt(new Point(1, 0))).toBe(99);
        expect(backend.getFgAt(new Point(2, 0))).toBe(1);
        // bg from base style preserved on overridden cell.
        expect(backend.getBgAt(new Point(1, 0))).toBe(2);
    });
});
