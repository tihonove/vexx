import { describe, expect, it, vi } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import type { KeyPressEvent } from "../Input/KeyEvent.ts";
import { DEFAULT_COLOR, packRgb } from "../Rendering/ColorUtils.ts";
import { Grid } from "../Rendering/Grid.ts";

import { MockTerminalBackend } from "./MockTerminalBackend.ts";

describe("MockTerminalBackend", () => {
    it("calls onInput callback when sendKey is used", () => {
        const backend = new MockTerminalBackend();
        const handler = vi.fn<(event: KeyPressEvent) => void>();
        backend.onInput(handler);

        backend.sendKey("a");

        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ type: "keydown", key: "a", raw: "a", ctrlKey: false }),
        );
        expect(handler).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ type: "keypress", key: "a", raw: "a", ctrlKey: false }),
        );
    });

    it("calls onInput callback when sendRaw is used", () => {
        const backend = new MockTerminalBackend();
        const handler = vi.fn<(event: KeyPressEvent) => void>();
        backend.onInput(handler);

        backend.sendRaw("\x03");

        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ type: "keydown", key: "c", ctrlKey: true }),
        );
        expect(handler).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ type: "keypress", key: "c", ctrlKey: true }),
        );
    });

    it("sends arrow keys via sendRaw", () => {
        const backend = new MockTerminalBackend();
        const handler = vi.fn<(event: KeyPressEvent) => void>();
        backend.onInput(handler);

        backend.sendRaw("\x1b[A");

        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ key: "ArrowUp", ctrlKey: false }));
    });

    it("sends arrow keys via sendKey DSL", () => {
        const backend = new MockTerminalBackend();
        const handler = vi.fn<(event: KeyPressEvent) => void>();
        backend.onInput(handler);

        backend.sendKey("ArrowUp");

        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ key: "ArrowUp" }));
    });

    it("returns configured size", () => {
        const backend = new MockTerminalBackend(new Size(120, 40));
        expect(backend.getSize()).toEqual(new Size(120, 40));
    });

    it("defaults to 80x24", () => {
        const backend = new MockTerminalBackend();
        expect(backend.getSize()).toEqual(new Size(80, 24));
    });

    it("supports multiple input listeners", () => {
        const backend = new MockTerminalBackend();
        const h1 = vi.fn();
        const h2 = vi.fn();
        backend.onInput(h1);
        backend.onInput(h2);

        backend.sendKey("x");

        expect(h1).toHaveBeenCalledTimes(2);
        expect(h2).toHaveBeenCalledTimes(2);
    });

    it("setup and teardown are no-ops (do not throw)", () => {
        const backend = new MockTerminalBackend();
        expect(() => {
            backend.setup();
        }).not.toThrow();
        expect(() => {
            backend.teardown();
        }).not.toThrow();
    });

    // ─── setCellAt / getTextAt / screenToString ───

    it("setCellAt stores a character in the grid", () => {
        const backend = new MockTerminalBackend(new Size(10, 5));
        backend.setCellAt(new Point(3, 2), "X");

        expect(backend.getTextAt(new Point(3, 2), 1)).toBe("X");
    });

    it("getTextAt reads a range of characters", () => {
        const backend = new MockTerminalBackend(new Size(20, 5));
        backend.setCellAt(new Point(0, 0), "H");
        backend.setCellAt(new Point(1, 0), "i");
        backend.setCellAt(new Point(2, 0), "!");

        expect(backend.getTextAt(new Point(0, 0), 3)).toBe("Hi!");
    });

    it("getTextAt returns spaces for empty cells", () => {
        const backend = new MockTerminalBackend(new Size(10, 5));
        backend.setCellAt(new Point(0, 0), "A");
        backend.setCellAt(new Point(2, 0), "B");

        expect(backend.getTextAt(new Point(0, 0), 3)).toBe("A B");
    });

    it("screenToString renders the full grid", () => {
        const backend = new MockTerminalBackend(new Size(5, 3));
        backend.setCellAt(new Point(0, 0), "A");
        backend.setCellAt(new Point(4, 2), "Z");

        expect(backend.screenToString()).toBe("A    \n" + "     \n" + "    Z");
    });

    it("clearScreen resets the grid", () => {
        const backend = new MockTerminalBackend(new Size(5, 3));
        backend.setCellAt(new Point(2, 1), "Q");
        backend.clearScreen();

        expect(backend.getTextAt(new Point(2, 1), 1)).toBe(" ");
    });

    it("setCellAt ignores out-of-bounds coordinates", () => {
        const backend = new MockTerminalBackend(new Size(5, 3));
        expect(() => {
            backend.setCellAt(new Point(-1, 0), "X");
        }).not.toThrow();
        expect(() => {
            backend.setCellAt(new Point(0, -1), "X");
        }).not.toThrow();
        expect(() => {
            backend.setCellAt(new Point(5, 0), "X");
        }).not.toThrow();
        expect(() => {
            backend.setCellAt(new Point(0, 3), "X");
        }).not.toThrow();
    });

    it("getTextAt returns spaces for out-of-bounds rows and columns", () => {
        const backend = new MockTerminalBackend(new Size(5, 3));
        // y out of range
        expect(backend.getTextAt(new Point(0, 5), 1)).toBe(" ");
        // x out of range (reading past the right edge)
        expect(backend.getTextAt(new Point(4, 0), 3)).toBe("   ");
        // negative x
        expect(backend.getTextAt(new Point(-1, 0), 1)).toBe(" ");
    });

    // ─── OSC responses ───

    it("simulateOscResponse invokes registered onOscResponse callbacks", () => {
        const backend = new MockTerminalBackend();
        const handler = vi.fn<(code: number, data: string) => void>();
        backend.onOscResponse(handler);

        backend.simulateOscResponse(11, "rgb:1212/3434/5656");

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(11, "rgb:1212/3434/5656");
    });

    it("simulateOscResponse with no listeners does not throw", () => {
        const backend = new MockTerminalBackend();
        expect(() => {
            backend.simulateOscResponse(10, "data");
        }).not.toThrow();
    });

    // ─── Bracketed paste ───

    it("sendPaste delivers the whole text as one block to onPaste listeners", () => {
        const backend = new MockTerminalBackend();
        const handler = vi.fn<(text: string) => void>();
        backend.onPaste(handler);

        backend.sendPaste("line one\nline two");

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith("line one\nline two");
    });

    it("sendRaw with bracketed-paste markers routes to onPaste, not onInput", () => {
        const backend = new MockTerminalBackend();
        const pasteHandler = vi.fn<(text: string) => void>();
        const keyHandler = vi.fn();
        backend.onPaste(pasteHandler);
        backend.onInput(keyHandler);

        backend.sendRaw("\x1b[200~hi\x1b[201~");

        expect(pasteHandler).toHaveBeenCalledWith("hi");
        expect(keyHandler).not.toHaveBeenCalled();
    });

    it("sendPaste with no paste listeners does not throw", () => {
        const backend = new MockTerminalBackend();
        expect(() => {
            backend.sendPaste("x");
        }).not.toThrow();
    });

    // ─── Foreground / background colours ───

    it("renderFrame records fg/bg colours readable via getFgAt/getBgAt", () => {
        const backend = new MockTerminalBackend(new Size(4, 2));
        const red = packRgb(255, 0, 0);
        const blue = packRgb(0, 0, 255);
        const grid = new Grid(new Size(4, 2));
        grid.setCell(new Point(1, 0), "A", red, blue);
        backend.renderFrame(grid, new Point(0, 0));

        expect(backend.getFgAt(new Point(1, 0))).toBe(red);
        expect(backend.getBgAt(new Point(1, 0))).toBe(blue);
    });

    it("getBgAt returns DEFAULT_COLOR for out-of-bounds positions", () => {
        const backend = new MockTerminalBackend(new Size(4, 2));
        expect(backend.getBgAt(new Point(-1, 0))).toBe(DEFAULT_COLOR);
        expect(backend.getBgAt(new Point(0, -1))).toBe(DEFAULT_COLOR);
        expect(backend.getBgAt(new Point(4, 0))).toBe(DEFAULT_COLOR);
        expect(backend.getBgAt(new Point(0, 2))).toBe(DEFAULT_COLOR);
    });

    it("getFgAt returns DEFAULT_COLOR for out-of-bounds positions", () => {
        const backend = new MockTerminalBackend(new Size(4, 2));
        expect(backend.getFgAt(new Point(-1, 0))).toBe(DEFAULT_COLOR);
        expect(backend.getFgAt(new Point(0, -1))).toBe(DEFAULT_COLOR);
        expect(backend.getFgAt(new Point(4, 0))).toBe(DEFAULT_COLOR);
        expect(backend.getFgAt(new Point(0, 2))).toBe(DEFAULT_COLOR);
    });

    // ─── Resize ───

    it("resize updates dimensions and notifies callbacks", () => {
        const backend = new MockTerminalBackend(new Size(10, 5));
        const handler = vi.fn();
        backend.onResize(handler);

        backend.resize(new Size(20, 10));

        expect(backend.getSize()).toEqual(new Size(20, 10));
        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(new Size(20, 10));
    });

    it("resize clears the screen grid", () => {
        const backend = new MockTerminalBackend(new Size(5, 3));
        backend.setCellAt(new Point(0, 0), "X");

        backend.resize(new Size(8, 4));

        expect(backend.getTextAt(new Point(0, 0), 1)).toBe(" ");
        expect(backend.getSize()).toEqual(new Size(8, 4));
    });

    it("resize supports multiple listeners", () => {
        const backend = new MockTerminalBackend(new Size(10, 5));
        const h1 = vi.fn();
        const h2 = vi.fn();
        backend.onResize(h1);
        backend.onResize(h2);

        backend.resize(new Size(30, 15));

        expect(h1).toHaveBeenCalledOnce();
        expect(h2).toHaveBeenCalledOnce();
    });
});
