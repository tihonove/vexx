import type { ITerminalBackend } from "../Backend/ITerminalBackend.ts";
import { Point, Size } from "../Common/GeometryPromitives.ts";

import { DEFAULT_COLOR } from "./ColorUtils.ts";
import type { CellPatch } from "./Grid.ts";
import { Grid } from "./Grid.ts";
import { StyleFlags } from "./StyleFlags.ts";

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
