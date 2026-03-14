import type { ITerminalBackend } from "../TerminalBackend/ITerminalBackend.ts";
import { Grid } from "../Rendering/Grid.ts";
import { DEFAULT_COLOR } from "../Rendering/ColorUtils.ts";
import { StyleFlags } from "../Rendering/StyleFlags.ts";

export interface CellData {
    char?: string;
    fg?: number;
    bg?: number;
    style?: number;
}

export class TerminalScreen {
    private grid: Grid;
    public width: number;
    public height: number;
    public cursorX = 0;
    public cursorY = 0;

    public constructor(width = 80, height = 24) {
        this.width = width;
        this.height = height;
        this.grid = new Grid(width, height);
    }

    public setCursorPosition(x: number, y: number): void {
        this.cursorX = x;
        this.cursorY = y;
    }

    public setCell(x: number, y: number, cell: CellData): void {
        const target = this.grid.getCell(x, y);
        if (cell.char !== undefined) target.char = cell.char;
        if (cell.fg !== undefined) target.fg = cell.fg;
        if (cell.bg !== undefined) target.bg = cell.bg;
        if (cell.style !== undefined) target.style = cell.style;
    }

    public flush(backend: ITerminalBackend): void {
        backend.renderFrame(this.grid, this.cursorX, this.cursorY);
    }

    public clear(): void {
        this.grid.fill(" ", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None);
    }
}
