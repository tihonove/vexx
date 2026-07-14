import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../vs/tui/backend/mockTerminalBackend.ts";
import { Point, Size } from "../Common/GeometryPromitives.ts";
import { packRgb } from "../vs/tui/rendering/colorUtils.ts";
import { TerminalScreen } from "../vs/tui/rendering/terminalScreen.ts";

import { BORDER_DOUBLE, BORDER_SINGLE } from "./BorderStyle.ts";
import { RenderContext } from "./TUIElement.ts";

function setup(
    width: number,
    height: number,
): { ctx: RenderContext; screen: TerminalScreen; backend: MockTerminalBackend } {
    const size = new Size(width, height);
    const screen = new TerminalScreen(size);
    const backend = new MockTerminalBackend(size);
    const ctx = new RenderContext(screen);
    return { ctx, screen, backend };
}

describe("RenderContext.drawBox", () => {
    it("draws a rounded frame with the default style", () => {
        const { ctx, screen, backend } = setup(6, 3);
        ctx.drawBox(0, 0, 6, 3);
        screen.flush(backend);

        expect(backend.getTextAt(new Point(0, 0), 6)).toBe("╭────╮");
        expect(backend.getTextAt(new Point(0, 1), 6)).toBe("│    │");
        expect(backend.getTextAt(new Point(0, 2), 6)).toBe("╰────╯");
    });

    it("applies fg/bg to every border cell", () => {
        const FG = packRgb(10, 20, 30);
        const BG = packRgb(40, 50, 60);
        const { ctx, screen, backend } = setup(4, 3);
        ctx.drawBox(0, 0, 4, 3, { fg: FG, bg: BG });
        screen.flush(backend);

        expect(backend.getFgAt(new Point(0, 0))).toBe(FG);
        expect(backend.getBgAt(new Point(0, 0))).toBe(BG);
        expect(backend.getFgAt(new Point(0, 1))).toBe(FG);
    });

    it("fills the interior with background when fill is true", () => {
        const BG = packRgb(1, 2, 3);
        const { ctx, screen, backend } = setup(5, 3);
        ctx.drawBox(0, 0, 5, 3, { bg: BG, fill: true });
        screen.flush(backend);

        // Interior is spaces on the fill background.
        expect(backend.getTextAt(new Point(1, 1), 3)).toBe("   ");
        expect(backend.getBgAt(new Point(2, 1))).toBe(BG);
    });

    it("draws T-connectors on separator rows", () => {
        const { ctx, screen, backend } = setup(6, 5);
        // Rows are offsets from the box top; row 2 becomes ├────┤.
        ctx.drawBox(0, 0, 6, 5, { separators: [2] });
        screen.flush(backend);

        expect(backend.getTextAt(new Point(0, 1), 6)).toBe("│    │");
        expect(backend.getTextAt(new Point(0, 2), 6)).toBe("├────┤");
        expect(backend.getTextAt(new Point(0, 3), 6)).toBe("│    │");
    });

    it("supports the straight single-line preset", () => {
        const { ctx, screen, backend } = setup(4, 3);
        ctx.drawBox(0, 0, 4, 3, { style: BORDER_SINGLE });
        screen.flush(backend);

        expect(backend.getTextAt(new Point(0, 0), 4)).toBe("┌──┐");
        expect(backend.getTextAt(new Point(0, 2), 4)).toBe("└──┘");
    });

    it("supports the double preset with double-line separators", () => {
        const { ctx, screen, backend } = setup(5, 5);
        ctx.drawBox(0, 0, 5, 5, { style: BORDER_DOUBLE, separators: [2] });
        screen.flush(backend);

        expect(backend.getTextAt(new Point(0, 0), 5)).toBe("╔═══╗");
        expect(backend.getTextAt(new Point(0, 1), 5)).toBe("║   ║");
        expect(backend.getTextAt(new Point(0, 2), 5)).toBe("╠═══╣");
        expect(backend.getTextAt(new Point(0, 4), 5)).toBe("╚═══╝");
    });

    it("honors the render offset", () => {
        const { ctx, screen, backend } = setup(8, 5);
        ctx.drawBox(2, 1, 4, 3);
        screen.flush(backend);

        expect(backend.getTextAt(new Point(2, 1), 4)).toBe("╭──╮");
        expect(backend.getTextAt(new Point(2, 3), 4)).toBe("╰──╯");
    });
});
