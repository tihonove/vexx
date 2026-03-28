import type { Point, Size } from "../Common/GeometryPromitives.ts";
import type { Grid } from "../Rendering/Grid.ts";

import type { KeyPressEvent } from "./KeyEvent.ts";

/**
 * Unified abstraction over terminal I/O.
 *
 * Two implementations:
 * - `NodeTerminalBackend` — real process.stdin/stdout
 * - `MockTerminalBackend` — in-memory for tests
 */
export interface ITerminalBackend {
    /** Subscribe to parsed keyboard input */
    onInput(callback: (event: KeyPressEvent) => void): void;

    /** Subscribe to terminal resize events */
    onResize(callback: (size: Size) => void): void;

    /**
     * Render a frame: receive the current grid and cursor position.
     * The backend decides how to output it (ANSI diffing, simple copy, etc.).
     */
    renderFrame(grid: Grid, cursorPosition: Point): void;

    /** Current terminal dimensions */
    getSize(): Size;

    /** Initialize terminal: alternate screen, raw mode, hide cursor, etc. */
    setup(): void;

    /** Restore terminal state: show cursor, normal screen, etc. */
    teardown(): void;
}
