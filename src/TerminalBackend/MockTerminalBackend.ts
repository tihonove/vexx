import type { ITerminalBackend } from "./ITerminalBackend.ts";
import type { KeyEvent } from "./KeyEvent.ts";
import { parseInput } from "./parseInput.ts";
import { serializeKey } from "./serializeKey.ts";

/**
 * In-memory terminal backend for testing.
 * 
 * Provides two ways to simulate input:
 * - `sendKey('a')`, `sendKey('Ctrl+C')` — human-readable DSL
 * - `sendRaw('\x1b[A')` — raw escape sequences for edge cases
 * 
 * Stores screen state in a 2D grid for assertions via getTextAt() / screenToString().
 */
export class MockTerminalBackend implements ITerminalBackend {
    private inputCallbacks: ((event: KeyEvent) => void)[] = [];
    private cells: (string | null)[][];

    public cols: number;
    public rows: number;

    constructor(cols: number = 80, rows: number = 24) {
        this.cols = cols;
        this.rows = rows;
        this.cells = this.createEmptyGrid();
    }

    private createEmptyGrid(): (string | null)[][] {
        return new Array(this.rows).fill(null).map(() => new Array(this.cols).fill(null));
    }

    onInput(callback: (event: KeyEvent) => void): void {
        this.inputCallbacks.push(callback);
    }

    setCellAt(x: number, y: number, char: string): void {
        if (y >= 0 && y < this.rows && x >= 0 && x < this.cols) {
            this.cells[y][x] = char;
        }
    }

    getSize(): { cols: number; rows: number } {
        return { cols: this.cols, rows: this.rows };
    }

    /** No-op for mock */
    setup(): void {}

    /** No-op for mock */
    teardown(): void {}

    // ─── Test helpers ───

    /**
     * Simulate a key press using human-readable name.
     * Examples: sendKey('a'), sendKey('Enter'), sendKey('Ctrl+C')
     */
    sendKey(name: string): void {
        const raw = serializeKey(name);
        const events = parseInput(raw);
        for (const event of events) {
            for (const cb of this.inputCallbacks) {
                cb(event);
            }
        }
    }

    /**
     * Simulate raw terminal input (escape sequences etc.)
     * Example: sendRaw('\x1b[A') for arrow up
     */
    sendRaw(data: string): void {
        const events = parseInput(data);
        for (const event of events) {
            for (const cb of this.inputCallbacks) {
                cb(event);
            }
        }
    }

    // ─── Screen assertions ───

    /**
     * Read a horizontal run of characters from the screen grid.
     */
    getTextAt(x: number, y: number, length: number): string {
        let result = "";
        for (let i = 0; i < length; i++) {
            const cell = (y >= 0 && y < this.rows && x + i >= 0 && x + i < this.cols)
                ? this.cells[y][x + i]
                : null;
            result += cell ?? " ";
        }
        return result;
    }

    /**
     * Render the entire screen as plain text (rows joined by \n).
     * Useful for snapshot testing.
     */
    screenToString(): string {
        const lines: string[] = [];
        for (let y = 0; y < this.rows; y++) {
            let line = "";
            for (let x = 0; x < this.cols; x++) {
                line += this.cells[y][x] ?? " ";
            }
            lines.push(line);
        }
        return lines.join("\n");
    }

    /** Clear the screen grid back to empty */
    clearScreen(): void {
        this.cells = this.createEmptyGrid();
    }
}
