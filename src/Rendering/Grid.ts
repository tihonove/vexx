import { Cell } from "./Cell.ts";
import { DEFAULT_COLOR } from "./ColorUtils.ts";
import { StyleFlags } from "./StyleFlags.ts";

/**
 * 2D grid of terminal cells backed by a flat array for cache-friendly access.
 *
 * Cell lookup: `cells[y * width + x]`.
 * `getCell` returns a direct reference — mutate it freely, no copies are made.
 */
export class Grid {
    public readonly width: number;
    public readonly height: number;
    public readonly cells: Cell[];

    public constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        const total = width * height;
        this.cells = new Array<Cell>(total);
        for (let i = 0; i < total; i++) {
            this.cells[i] = Cell.empty();
        }
    }

    public getCell(x: number, y: number): Cell {
        return this.cells[y * this.width + x];
    }

    public setCell(
        x: number,
        y: number,
        char: string,
        fg: number = DEFAULT_COLOR,
        bg: number = DEFAULT_COLOR,
        style: number = StyleFlags.None,
    ): void {
        const cell = this.cells[y * this.width + x];
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
