import { Point, Size } from "../Common/GeometryPromitives.ts";
import type { KeyPressEvent } from "../Input/KeyEvent.ts";
import { KeyInputParser } from "../Input/KeyInputParser.ts";
import type { MouseToken } from "../Input/RawTerminalToken.ts";
import { serializeKey } from "../Input/serializeKey.ts";
import { DEFAULT_COLOR } from "../Rendering/ColorUtils.ts";
import type { Grid } from "../Rendering/Grid.ts";

import type { ITerminalBackend } from "./ITerminalBackend.ts";

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
    private mouseCallbacks: ((event: MouseToken) => void)[] = [];
    private resizeCallbacks: ((size: Size) => void)[] = [];
    private cells: (string | null)[][];
    private bgs: number[][];

    public size: Size;
    private readonly inputParser = new KeyInputParser();

    public constructor(size: Size = new Size(80, 24)) {
        this.size = size;
        this.cells = this.createEmptyGrid();
        this.bgs = this.createBgGrid();
    }

    private createEmptyGrid(): (string | null)[][] {
        const value: string | null = null;
        return new Array<(string | null)[]>(this.size.height)
            .fill([])
            .map(() => new Array<string | null>(this.size.width).fill(value));
    }

    private createBgGrid(): number[][] {
        return new Array<number[]>(this.size.height)
            .fill([])
            .map(() => new Array<number>(this.size.width).fill(DEFAULT_COLOR));
    }

    public onInput(callback: (event: KeyPressEvent) => void): void {
        this.inputCallbacks.push(callback);
    }

    public onMouse(callback: (event: MouseToken) => void): void {
        this.mouseCallbacks.push(callback);
    }

    public onResize(callback: (size: Size) => void): void {
        this.resizeCallbacks.push(callback);
    }

    public cursorPosition: Point = new Point(0, 0);

    public renderFrame(grid: Grid, cursorPosition: Point): void {
        for (let y = 0; y < grid.height && y < this.size.height; y++) {
            for (let x = 0; x < grid.width && x < this.size.width; x++) {
                const cell = grid.getCellAt(x, y);
                this.cells[y][x] = cell.char;
                this.bgs[y][x] = cell.bg;
            }
        }
        this.cursorPosition = cursorPosition;
    }

    public getSize(): Size {
        return this.size;
    }

    public setup(): void {
        // No-op for mock
    }

    public teardown(): void {
        // No-op for mock
    }

    // ─── Test helpers ───

    /** Set a character directly in the screen grid (test helper, not part of ITerminalBackend) */
    public setCellAt(position: Point, char: string): void {
        if (position.y >= 0 && position.y < this.size.height && position.x >= 0 && position.x < this.size.width) {
            this.cells[position.y][position.x] = char;
        }
    }

    /**
     * Simulate a key press using human-readable name.
     * Examples: sendKey('a'), sendKey('Enter'), sendKey('Ctrl+C')
     */
    public sendKey(name: string): void {
        const raw = serializeKey(name);
        const events = this.inputParser.parse(raw);
        for (const event of events) {
            for (const cb of this.inputCallbacks) {
                cb(event);
            }
        }
    }

    /**
     * Simulate a mouse event using a MouseToken object.
     */
    public simulateMouse(token: MouseToken): void {
        for (const cb of this.mouseCallbacks) {
            cb(token);
        }
    }

    /**
     * Simulate raw terminal input (escape sequences etc.)
     * Example: sendRaw('\x1b[A') for arrow up
     */
    public sendRaw(data: string): void {
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
    public getTextAt(position: Point, length: number): string {
        let result = "";
        for (let i = 0; i < length; i++) {
            const cell =
                position.y >= 0 &&
                position.y < this.size.height &&
                position.x + i >= 0 &&
                position.x + i < this.size.width
                    ? this.cells[position.y][position.x + i]
                    : null;
            result += cell ?? " ";
        }
        return result;
    }

    /**
     * Render the entire screen as plain text (rows joined by \n).
     * Useful for snapshot testing.
     */
    public screenToString(): string {
        const lines: string[] = [];
        for (let y = 0; y < this.size.height; y++) {
            let line = "";
            for (let x = 0; x < this.size.width; x++) {
                line += this.cells[y][x] ?? " ";
            }
            lines.push(line);
        }
        return lines.join("\n");
    }

    /** Clear the screen grid back to empty */
    public clearScreen(): void {
        this.cells = this.createEmptyGrid();
        this.bgs = this.createBgGrid();
    }

    /**
     * Simulate a terminal resize.
     * Updates dimensions, recreates the grid, and notifies all resize callbacks.
     */
    public getBgAt(position: Point): number {
        if (position.y >= 0 && position.y < this.size.height && position.x >= 0 && position.x < this.size.width) {
            return this.bgs[position.y][position.x];
        }
        return DEFAULT_COLOR;
    }

    public resize(size: Size): void {
        this.size = size;
        this.cells = this.createEmptyGrid();
        this.bgs = this.createBgGrid();
        for (const cb of this.resizeCallbacks) {
            cb(size);
        }
    }
}
