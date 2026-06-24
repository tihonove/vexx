import { describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { Grid } from "../Rendering/Grid.ts";

import { NodeTerminalBackend } from "./NodeTerminalBackend.ts";

/**
 * Minimal stdout double that records every write. Only `write` is exercised by
 * renderFrame(); `columns`/`rows` exist so getSize() stays usable if called.
 */
function createFakeStdout(): { writes: string[]; stream: NodeJS.WriteStream } {
    const writes: string[] = [];
    const stream = {
        columns: 80,
        rows: 24,
        write(data: string): boolean {
            writes.push(data);
            return true;
        },
        on() {
            /* no-op */
        },
        removeListener() {
            /* no-op */
        },
    };
    return { writes, stream: stream as unknown as NodeJS.WriteStream };
}

function createBackend(): { backend: NodeTerminalBackend; writes: string[] } {
    const { writes, stream } = createFakeStdout();
    const fakeStdin = {} as unknown as NodeJS.ReadStream;
    // setup() is never called — we drive renderFrame() directly.
    const backend = new NodeTerminalBackend(fakeStdin, stream);
    return { backend, writes };
}

describe("NodeTerminalBackend.renderFrame — flicker prevention", () => {
    it("writes nothing on a repeated frame with no cell changes and an unchanged cursor", () => {
        const { backend, writes } = createBackend();
        const grid = new Grid(new Size(10, 3));
        grid.setCell(new Point(0, 0), "A");
        const cursor = new Point(0, 0);

        backend.renderFrame(grid, cursor);
        expect(writes.join("")).not.toBe(""); // first frame paints

        writes.length = 0;
        // This is exactly what a mouse-move over a static area produces.
        backend.renderFrame(grid, cursor);

        expect(writes).toEqual([]);
    });

    it("still paints when a cell changes between frames", () => {
        const { backend, writes } = createBackend();
        const grid = new Grid(new Size(10, 3));
        grid.setCell(new Point(0, 0), "A");
        const cursor = new Point(0, 0);

        backend.renderFrame(grid, cursor);
        writes.length = 0;

        grid.setCell(new Point(1, 0), "B");
        backend.renderFrame(grid, cursor);

        expect(writes.join("")).toContain("B");
    });

    it("emits a frame when only the cursor moves (no cell changes)", () => {
        const { backend, writes } = createBackend();
        const grid = new Grid(new Size(10, 3));
        grid.setCell(new Point(0, 0), "A");

        backend.renderFrame(grid, new Point(0, 0));
        writes.length = 0;

        backend.renderFrame(grid, new Point(3, 1));

        const out = writes.join("");
        expect(out).toContain("\x1b[2;4H"); // CUP to (row 2, col 4)
        expect(out).toContain("\x1b[?25h"); // show cursor
    });

    it("hides the cursor when cursorPosition becomes null after being visible", () => {
        const { backend, writes } = createBackend();
        const grid = new Grid(new Size(10, 3));
        grid.setCell(new Point(0, 0), "A");

        backend.renderFrame(grid, new Point(0, 0));
        writes.length = 0;

        backend.renderFrame(grid, null);

        const out = writes.join("");
        expect(out).toContain("\x1b[?25l"); // hide cursor
        expect(out).not.toContain("\x1b[?25h"); // and never re-shows it
    });
});
