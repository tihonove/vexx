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
    onResize(callback: (size: { cols: number; rows: number }) => void): void;

    /** Set a character at given screen coordinates (0-based) */
    setCellAt(x: number, y: number, char: string): void;

    showCursor(): void;

    hideCursor(): void;

    /** Move the hardware terminal cursor to the given screen coordinates (0-based) */
    setCursorPosition(x: number, y: number): void;

    /**
     * Begin synchronized output (DEC private mode 2026).
     * Terminal buffers all output until endSynchronizedOutput() and
     * applies it atomically — eliminates flicker on full-screen redraws.
     */
    beginSynchronizedOutput(): void;

    /**
     * End synchronized output — terminal flushes the buffered frame.
     */
    endSynchronizedOutput(): void;

    /** Current terminal dimensions */
    getSize(): { cols: number; rows: number };

    /** Initialize terminal: alternate screen, raw mode, hide cursor, etc. */
    setup(): void;

    /** Restore terminal state: show cursor, normal screen, etc. */
    teardown(): void;
}
