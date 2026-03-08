import type { ITerminalBackend } from "../TerminalBackend/ITerminalBackend.ts";

interface Cell {
    char?: string;
}

export class TerminalScreen {
    private cells: (null | Cell)[][] = [];
    public width = 80;
    public height = 24;
    public cursorX = 0;
    public cursorY = 0;

    constructor(width = 80, height = 24) {
        this.width = width;
        this.height = height;
        this.cells = new Array<Cell[][]>(height).fill([]).map(() => new Array<Cell>(width).fill({}));
    }

    public setCursorPosition(x: number, y: number): void {
        this.cursorX = x;
        this.cursorY = y;
    }

    public setCell(x: number, y: number, cell: Partial<Cell>): void {
        if (!this.cells[y]) {
            this.cells[y] = [];
        }
        this.cells[y][x] = { ...this.cells[y][x], ...cell };
    }

    /**
     * Flush the screen buffer to a terminal backend.
     * Calls backend.setCellAt() for each cell — the backend decides
     * how to handle it (ANSI escape for real terminal, grid store for mock).
     */
    public flush(backend: ITerminalBackend): void {
        backend.hideCursor();
        for (let y = 0; y < this.cells.length; y++) {
            const row = this.cells[y];
            for (let x = 0; x < row.length; x++) {
                const cell = row[x];
                const ch = cell?.char ?? " ";
                backend.setCellAt(x, y, ch);
            }
        }
        backend.showCursor();
        backend.setCursorPosition(this.cursorX, this.cursorY);
    }

    /**
     * Clear all cells back to empty state.
     */
    public clear(): void {
        this.cells = new Array<Cell[][]>(this.height).fill([]).map(() => new Array<Cell>(this.width).fill({}));
    }
}
