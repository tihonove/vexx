import type { ITerminalBackend } from "../TerminalBackend/ITerminalBackend.ts";
import { Grid } from "../Rendering/Grid.ts";
import type { CellPatch } from "../Rendering/Grid.ts";
import { DEFAULT_COLOR } from "../Rendering/ColorUtils.ts";
import { StyleFlags } from "../Rendering/StyleFlags.ts";
import { Point, Size } from "../Common/GeometryPromitives.ts";

export class TerminalScreen {
    private grid: Grid;
    public size: Size;
    public cursorPosition: Point = new Point(0, 0);

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

    public setCell(position: Point, cell: CellPatch): void {
        this.grid.updateCell(position, cell);
    }

    public flush(backend: ITerminalBackend): void {
        backend.renderFrame(this.grid, this.cursorPosition);
    }

    public clear(): void {
        this.grid.fill(" ", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.None);
    }
}
