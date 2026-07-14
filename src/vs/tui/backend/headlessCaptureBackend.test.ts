import { describe, expect, it, vi } from "vitest";

import { Point, Size } from "../../../Common/GeometryPromitives.ts";
import type { KeyPressEvent } from "../input/keyEvent.ts";
import { packRgb } from "../rendering/colorUtils.ts";
import { Grid } from "../rendering/grid.ts";
import { StyleFlags } from "../rendering/styleFlags.ts";

import { HeadlessCaptureBackend } from "./headlessCaptureBackend.ts";

describe("HeadlessCaptureBackend", () => {
    it("reports its configured size", () => {
        const backend = new HeadlessCaptureBackend(new Size(100, 40));
        expect(backend.getSize()).toEqual(new Size(100, 40));
    });

    it("defaults to 120x32", () => {
        expect(new HeadlessCaptureBackend().getSize()).toEqual(new Size(120, 32));
    });

    it("returns an empty snapshot before the first render", () => {
        const backend = new HeadlessCaptureBackend(new Size(3, 2));
        const frame = backend.captureFrame();
        expect(frame.cols).toBe(3);
        expect(frame.rows).toBe(2);
        expect(frame.cells).toHaveLength(6);
        expect(frame.cells.every((c) => c.char === " ")).toBe(true);
        expect(frame.cursor).toBeNull();
    });

    it("injects keys through the real parser to onInput subscribers", () => {
        const backend = new HeadlessCaptureBackend();
        const events: KeyPressEvent[] = [];
        backend.onInput((e) => events.push(e));

        backend.sendKey("a");

        expect(events.some((e) => e.key === "a")).toBe(true);
    });

    it("injects Ctrl+C as a control key event", () => {
        const backend = new HeadlessCaptureBackend();
        const events: KeyPressEvent[] = [];
        backend.onInput((e) => events.push(e));

        backend.sendKey("Ctrl+C");

        expect(events.some((e) => e.ctrlKey && e.key === "c")).toBe(true);
    });

    it("delivers Escape immediately (drains the pending tail)", () => {
        const backend = new HeadlessCaptureBackend();
        const events: KeyPressEvent[] = [];
        backend.onInput((e) => events.push(e));

        backend.sendKey("Escape");

        expect(events.some((e) => e.key === "Escape")).toBe(true);
    });

    it("delivers a paste as a single block to onPaste subscribers", () => {
        const backend = new HeadlessCaptureBackend();
        const pastes: string[] = [];
        backend.onPaste((t) => pastes.push(t));

        backend.sendPaste("hello world");

        expect(pastes).toEqual(["hello world"]);
    });

    it("forwards mouse tokens to onMouse subscribers", () => {
        const backend = new HeadlessCaptureBackend();
        const onMouse = vi.fn();
        backend.onMouse(onMouse);

        const token = { type: "mouse" as const } as unknown as Parameters<typeof backend.simulateMouse>[0];
        backend.simulateMouse(token);

        expect(onMouse).toHaveBeenCalledWith(token);
    });

    it("captures a rendered frame with char, colours, style and width", () => {
        const backend = new HeadlessCaptureBackend(new Size(4, 1));
        const grid = new Grid(new Size(4, 1));
        const fg = packRgb(10, 20, 30);
        const bg = packRgb(40, 50, 60);
        grid.setCell(new Point(0, 0), "A", fg, bg, StyleFlags.Bold | StyleFlags.Italic, 1);
        grid.setCell(new Point(1, 0), "中", fg, bg, StyleFlags.None, 2);

        backend.renderFrame(grid, new Point(2, 0));
        const frame = backend.captureFrame();

        expect(frame.cursor).toEqual({ x: 2, y: 0 });
        expect(frame.cells[0]).toEqual({
            char: "A",
            fg,
            bg,
            style: StyleFlags.Bold | StyleFlags.Italic,
            width: 1,
        });
        expect(frame.cells[1].char).toBe("中");
        expect(frame.cells[1].width).toBe(2);
        // Continuation cell of the wide char has width 0.
        expect(frame.cells[2].width).toBe(0);
    });

    it("snapshots each frame independently of later grid mutations", () => {
        const backend = new HeadlessCaptureBackend(new Size(1, 1));
        const grid = new Grid(new Size(1, 1));
        grid.setCell(new Point(0, 0), "X");
        backend.renderFrame(grid, null);

        // Mutating the same grid after render must not change the taken snapshot.
        grid.setCell(new Point(0, 0), "Y");

        expect(backend.captureFrame().cells[0].char).toBe("X");
    });

    it("resize updates the size and notifies subscribers", () => {
        const backend = new HeadlessCaptureBackend(new Size(80, 24));
        const onResize = vi.fn();
        backend.onResize(onResize);

        backend.resize(new Size(120, 40));

        expect(backend.getSize()).toEqual(new Size(120, 40));
        expect(onResize).toHaveBeenCalledWith(new Size(120, 40));
    });

    it("setup/teardown/writeOscSequence/probeKeyboardProtocol are inert no-ops", () => {
        const backend = new HeadlessCaptureBackend();
        const probe = vi.fn();
        expect(() => {
            backend.setup();
            backend.teardown();
            backend.writeOscSequence("\x1b]52;c;abc\x07");
            backend.onOscResponse(() => undefined);
            backend.probeKeyboardProtocol(probe);
        }).not.toThrow();
        // The probe is intentionally never resolved in headless mode.
        expect(probe).not.toHaveBeenCalled();
    });
});
