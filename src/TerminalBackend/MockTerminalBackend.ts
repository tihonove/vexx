import type { ITerminalBackend } from "./ITerminalBackend.ts";
import type { KeyPressEvent } from "./KeyEvent.ts";
import type { Grid } from "../Rendering/Grid.ts";
import { KeyInputParser } from "./KeyInputParser.ts";
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
    private inputCallbacks: ((event: KeyPressEvent) => void)[] = [];
    private resizeCallbacks: ((size: { cols: number; rows: number }) => void)[] = [];
    private cells: (string | null)[][];

    public cols: number;
    public rows: number;
    private readonly inputParser = new KeyInputParser();

    constructor(cols = 80, rows = 24) {
        this.cols = cols;
        this.rows = rows;
        this.cells = this.createEmptyGrid();
    }

    private createEmptyGrid(): (string | null)[][] {
        const value: string | null = null;
        return new Array<(string | null)[]>(this.rows)
            .fill([])
            .map(() => new Array<string | null>(this.cols).fill(value));
    }

    onInput(callback: (event: KeyPressEvent) => void): void {
        this.inputCallbacks.push(callback);
    }

    onResize(callback: (size: { cols: number; rows: number }) => void): void {
        this.resizeCallbacks.push(callback);
    }

    public cursorX = 0;
    public cursorY = 0;

    renderFrame(grid: Grid, cursorX: number, cursorY: number): void {
        for (let y = 0; y < grid.height && y < this.rows; y++) {
            for (let x = 0; x < grid.width && x < this.cols; x++) {
                this.cells[y][x] = grid.getCell(x, y).char;
            }
        }
        this.cursorX = cursorX;
        this.cursorY = cursorY;
    }

    getSize(): { cols: number; rows: number } {
        return { cols: this.cols, rows: this.rows };
    }

    setup(): void {
        // No-op for mock
    }

    teardown(): void {
        // No-op for mock
    }

    // ─── Test helpers ───

    /** Set a character directly in the screen grid (test helper, not part of ITerminalBackend) */
    setCellAt(x: number, y: number, char: string): void {
        if (y >= 0 && y < this.rows && x >= 0 && x < this.cols) {
            this.cells[y][x] = char;
        }
    }

    /**
     * Simulate a key press using human-readable name.
     * Examples: sendKey('a'), sendKey('Enter'), sendKey('Ctrl+C')
     */
    sendKey(name: string): void {
        const raw = serializeKey(name);
        const events = this.inputParser.parse(raw);
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
        const events = this.inputParser.parse(data);
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
            const cell = y >= 0 && y < this.rows && x + i >= 0 && x + i < this.cols ? this.cells[y][x + i] : null;
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

    /**
     * Simulate a terminal resize.
     * Updates dimensions, recreates the grid, and notifies all resize callbacks.
     */
    resize(cols: number, rows: number): void {
        this.cols = cols;
        this.rows = rows;
        this.cells = this.createEmptyGrid();
        const size = { cols, rows };
        for (const cb of this.resizeCallbacks) {
            cb(size);
        }
    }
}
