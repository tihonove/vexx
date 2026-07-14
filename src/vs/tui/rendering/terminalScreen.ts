import type { ITerminalBackend } from "../backend/terminalBackend.ts";
import { Point, Size } from "../../../Common/GeometryPromitives.ts";

import { DEFAULT_COLOR } from "./colorUtils.ts";
import type { CellPatch } from "./grid.ts";
import { Grid } from "./grid.ts";
import { StyleFlags } from "./styleFlags.ts";

export class TerminalScreen {
    private grid: Grid;
    public size: Size;
    public cursorPosition: Point | null = null;

    public get width(): number {
        return this.size.width;
    }
    public get height(): number {
        return this.size.height;
    }

    public constructor(size: Size = new Size(80, 24)) {
        this.size = size;
        this.grid = new Grid(size);
    }

    public setCursorPosition(position: Point): void {
        this.cursorPosition = position;
    }

    public clearCursorPosition(): void {
        this.cursorPosition = null;
    }

    public setCell(position: Point, cell: CellPatch): void {
        this.grid.updateCell(position, cell);
    }

    public flush(backend: ITerminalBackend): void {
        backend.renderFrame(this.grid, this.cursorPosition);
    }

    public clear(): void {
        this.grid.fill(" ", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None);
        this.cursorPosition = null;
    }
}
