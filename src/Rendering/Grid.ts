import { Cell } from "./Cell.ts";
import { DEFAULT_COLOR } from "./ColorUtils.ts";
import { StyleFlags } from "./StyleFlags.ts";
import { Point, Size } from "../Common/GeometryPromitives.ts";

/**
 * 2D grid of terminal cells backed by a flat array for cache-friendly access.
 *
 * Cell lookup: `cells[y * width + x]`.
 * `getCell` returns a direct reference — mutate it freely, no copies are made.
 */
export class Grid {
    public readonly size: Size;
    public readonly cells: Cell[];

    public get width(): number { return this.size.width; }
    public get height(): number { return this.size.height; }

    public constructor(size: Size) {
        this.size = size;
        const total = size.width * size.height;
        this.cells = new Array<Cell>(total);
        for (let i = 0; i < total; i++) {
            this.cells[i] = Cell.empty();
        }
    }

    public getCell(position: Point): Cell {
        return this.cells[position.y * this.size.width + position.x];
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
