import type { ITerminalBackend } from "./ITerminalBackend.ts";
import type { KeyEvent } from "./KeyEvent.ts";
import { parseInput } from "./parseInput.ts";

/**
 * Real terminal backend: reads from process.stdin, writes to process.stdout.
 * Handles alternate screen, raw mode, cursor visibility, signal cleanup.
 */
export class NodeTerminalBackend implements ITerminalBackend {
    private inputCallbacks: ((event: KeyEvent) => void)[] = [];
    private resizeCallbacks: ((size: { cols: number; rows: number }) => void)[] = [];
    private stdin: NodeJS.ReadStream;
    private stdout: NodeJS.WriteStream;
    private onDataHandler: ((chunk: string) => void) | null = null;
    private onResizeHandler: (() => void) | null = null;
    private resizeThrottleTimer: ReturnType<typeof setTimeout> | null = null;
    private resizeThrottleMs: number;
    private lastEmittedSize: { cols: number; rows: number } | null = null;
    private resizePending = false;
    private cleanupHandlers: (() => void)[] = [];

    constructor(
        stdin: NodeJS.ReadStream = process.stdin,
        stdout: NodeJS.WriteStream = process.stdout,
        options?: { resizeThrottleMs?: number },
    ) {
        this.stdin = stdin;
        this.stdout = stdout;
        this.resizeThrottleMs = options?.resizeThrottleMs ?? 100;
    }

    onInput(callback: (event: KeyEvent) => void): void {
        this.inputCallbacks.push(callback);
    }

    onResize(callback: (size: { cols: number; rows: number }) => void): void {
        this.resizeCallbacks.push(callback);
    }

    /** Emit resize only if dimensions actually changed */
    private emitResize(): void {
        const size = this.getSize();
        if (
            this.lastEmittedSize !== null &&
            this.lastEmittedSize.cols === size.cols &&
            this.lastEmittedSize.rows === size.rows
        ) {
            return;
        }
        this.lastEmittedSize = size;
        for (const cb of this.resizeCallbacks) {
            cb(size);
        }
    }

    setCellAt(x: number, y: number, char: string): void {
        // ANSI cursor positioning: \x1b[row;colH (1-based)
        this.stdout.write(`\x1b[${y + 1};${x + 1}H${char}`);
    }

    getSize(): { cols: number; rows: number } {
        return {
            cols: this.stdout.columns ?? 80,
            rows: this.stdout.rows ?? 24,
        };
    }

    setup(): void {
        // Switch to alternate screen buffer
        this.stdout.write("\x1b[?1049h");
        // Hide cursor
        this.stdout.write("\x1b[?25l");

        // Raw mode for character-by-character input
        this.stdin.setRawMode(true);
        this.stdin.setEncoding("utf8");
        this.stdin.resume();

        // Listen for input
        this.onDataHandler = (chunk: string) => {
            const events = parseInput(chunk);
            for (const event of events) {
                for (const cb of this.inputCallbacks) {
                    cb(event);
                }
            }
        };
        this.stdin.on("data", this.onDataHandler);

        // Listen for terminal resize (throttled + deduplicated)
        this.onResizeHandler = () => {
            if (this.resizeThrottleTimer !== null) {
                // Already throttling — just mark that a new resize arrived
                this.resizePending = true;
                return;
            }
            this.emitResize();
            this.resizeThrottleTimer = setTimeout(() => {
                this.resizeThrottleTimer = null;
                if (this.resizePending) {
                    this.resizePending = false;
                    this.emitResize();
                }
            }, this.resizeThrottleMs);
        };
        this.stdout.on("resize", this.onResizeHandler);

        // Cleanup on exit/SIGINT
        const onExit = () => {
            this.teardown();
        };
        const onSigint = () => {
            this.teardown();
            process.exit(0);
        };

        process.on("exit", onExit);
        process.on("SIGINT", onSigint);

        this.cleanupHandlers.push(() => {
            process.removeListener("exit", onExit);
            process.removeListener("SIGINT", onSigint);
        });
    }

    teardown(): void {
        // Restore cursor
        this.stdout.write("\x1b[?25h");
        // Restore normal screen buffer
        this.stdout.write("\x1b[?1049l");

        // Remove stdin listener
        if (this.onDataHandler) {
            this.stdin.removeListener("data", this.onDataHandler);
            this.onDataHandler = null;
        }

        // Cancel pending throttle and remove resize listener
        if (this.resizeThrottleTimer !== null) {
            clearTimeout(this.resizeThrottleTimer);
            this.resizeThrottleTimer = null;
        }
        this.resizePending = false;
        if (this.onResizeHandler) {
            this.stdout.removeListener("resize", this.onResizeHandler);
            this.onResizeHandler = null;
        }

        // Remove process listeners
        for (const cleanup of this.cleanupHandlers) {
            cleanup();
        }
        this.cleanupHandlers = [];
    }
}
