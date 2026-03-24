import { Cell } from "./Cell.ts";
import { DEFAULT_COLOR } from "./ColorUtils.ts";
import { StyleFlags } from "./StyleFlags.ts";
import { Point, Size } from "../Common/GeometryPromitives.ts";

export interface ReadonlyCellData {
    readonly char: string;
    readonly fg: number;
    readonly bg: number;
    readonly style: number;
}

export interface CellPatch {
    char?: string;
    fg?: number;
    bg?: number;
    style?: number;
}

/**
 * 2D grid of terminal cells backed by a flat array for cache-friendly access.
 */
export class Grid {
    public readonly size: Size;
    private readonly cells: Cell[];

    public get width(): number {
        return this.size.width;
    }
    public get height(): number {
        return this.size.height;
    }
    public get cellCount(): number {
        return this.cells.length;
    }

    public constructor(size: Size) {
        this.size = size;
        const total = size.width * size.height;
        this.cells = new Array<Cell>(total);
        for (let i = 0; i < total; i++) {
            this.cells[i] = Cell.empty();
        }
    }

    public getCell(position: Point): ReadonlyCellData {
        return this.cells[position.y * this.size.width + position.x];
    }

    public getCellAt(x: number, y: number): ReadonlyCellData {
        return this.cells[y * this.size.width + x];
    }

    public setCell(
        position: Point,
        char: string,
        fg: number = DEFAULT_COLOR,
        bg: number = DEFAULT_COLOR,
        style: number = StyleFlags.None,
    ): void {
        const cell = this.cells[position.y * this.size.width + position.x];
        cell.char = char;
        cell.fg = fg;
        cell.bg = bg;
        cell.style = style;
    }

    public updateCell(position: Point, patch: CellPatch): void {
        const cell = this.cells[position.y * this.size.width + position.x];
        if (patch.char !== undefined) cell.char = patch.char;
        if (patch.fg !== undefined) cell.fg = patch.fg;
        if (patch.bg !== undefined) cell.bg = patch.bg;
        if (patch.style !== undefined) cell.style = patch.style;
    }

    public cellEqualsAt(x: number, y: number, other: Grid): boolean {
        const idx = y * this.size.width + x;
        return this.cells[idx].equals(other.cells[idx]);
    }

    public copyCellFrom(x: number, y: number, source: Grid): void {
        const idx = y * this.size.width + x;
        this.cells[idx].copyFrom(source.cells[idx]);
    }

    public copyAllCellsFrom(source: Grid): void {
        for (let i = 0, len = this.cells.length; i < len; i++) {
            this.cells[i].copyFrom(source.cells[i]);
        }
    }

    public fill(
        char = " ",
        fg: number = DEFAULT_COLOR,
        bg: number = DEFAULT_COLOR,
        style: number = StyleFlags.None,
    ): void {
        for (let i = 0, len = this.cells.length; i < len; i++) {
            const cell = this.cells[i];
            cell.char = char;
            cell.fg = fg;
            cell.bg = bg;
            cell.style = style;
        }
    }
}
