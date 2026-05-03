import type { Point, Size } from "../Common/GeometryPromitives.ts";
import type { KeyPressEvent } from "../Input/KeyEvent.ts";
import type { MouseToken } from "../Input/RawTerminalToken.ts";
import type { Grid } from "../Rendering/Grid.ts";

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

    /** Subscribe to raw mouse events */
    onMouse(callback: (event: MouseToken) => void): void;

    /** Subscribe to terminal resize events */
    onResize(callback: (size: Size) => void): void;

    /** Subscribe to OSC response sequences from the terminal (e.g. OSC 52 clipboard replies) */
    onOscResponse(callback: (code: number, data: string) => void): void;

    /**
     * Render a frame: receive the current grid and cursor position.
     * The backend decides how to output it (ANSI diffing, simple copy, etc.).
     */
    renderFrame(grid: Grid, cursorPosition: Point | null): void;

    /** Current terminal dimensions */
    getSize(): Size;

    /** Initialize terminal: alternate screen, raw mode, hide cursor, etc. */
    setup(): void;

    /** Restore terminal state: show cursor, normal screen, etc. */
    teardown(): void;
}
