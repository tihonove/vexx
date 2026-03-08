import type { ITerminalBackend } from "../TerminalBackend/ITerminalBackend.ts";

interface Cell {
    char?: string;
}

/** Sentinel cell for the initial frame — guaranteed to differ from any real cell. */
const SENTINEL_CELL: ResolvedCell = { char: "\x00" };

/**
 * Cell with all fields resolved to concrete values (no undefineds).
 * Used for the previous-frame buffer so comparisons are trivial.
 */
interface ResolvedCell {
    char: string;
}

function resolveCell(cell: Cell | null | undefined): ResolvedCell {
    return {
        char: cell?.char ?? " ",
    };
}

function cellsEqual(a: ResolvedCell, b: ResolvedCell): boolean {
    return a.char === b.char;
}

export class TerminalScreen {
    private cells: (null | Cell)[][] = [];
    /**
     * Stores fully resolved cells from the previous flush.
     * Compared field-by-field via cellsEqual() so that adding new
     * fields to Cell (fg, bg, styles…) automatically participates in diff.
     */
    private prevCells: ResolvedCell[][] | null = null;
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
     * Uses double buffering: compares current cells against the previous frame
     * and only sends setCellAt() for cells that actually changed.
     */
    public flush(backend: ITerminalBackend): void {
        if (this.prevCells === null) {
            this.prevCells = new Array(this.height)
                .fill(null)
                .map(() => new Array(this.width).fill(null).map(() => ({ ...SENTINEL_CELL })));
        }

        backend.beginSynchronizedOutput();
        backend.hideCursor();

        for (let y = 0; y < this.cells.length; y++) {
            const row = this.cells[y];
            const prevRow = this.prevCells[y];
            for (let x = 0; x < row.length; x++) {
                const resolved = resolveCell(row[x]);
                if (!cellsEqual(resolved, prevRow[x])) {
                    backend.setCellAt(x, y, resolved.char);
                    prevRow[x] = resolved;
                }
            }
        }

        backend.setCursorPosition(this.cursorX, this.cursorY);
        backend.showCursor();
        backend.endSynchronizedOutput();
    }

    /**
     * Clear all cells back to empty state.
     * Does NOT reset prevChars — the diff in flush() will detect the changes.
     */
    public clear(): void {
        this.cells = new Array<Cell[][]>(this.height).fill([]).map(() => new Array<Cell>(this.width).fill({}));
    }
}
