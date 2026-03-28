import { describe, expect, it, vi } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";

import type { KeyPressEvent } from "./KeyEvent.ts";
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
