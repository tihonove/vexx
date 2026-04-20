import { Point, Size } from "../Common/GeometryPromitives.ts";

import { Cell } from "./Cell.ts";
import { DEFAULT_COLOR } from "./ColorUtils.ts";
import { StyleFlags } from "./StyleFlags.ts";

export interface ReadonlyCellData {
    readonly char: string;
    readonly fg: number;
    readonly bg: number;
    readonly style: number;
    readonly width: number;
}

export interface CellPatch {
    char?: string;
    fg?: number;
    bg?: number;
    style?: number;
    width?: number;
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
        width = 1,
    ): void {
        const x = position.x;
        const y = position.y;
        const idx = y * this.size.width + x;
        const cell = this.cells[idx];

        // If overwriting a continuation cell, clear the head cell of that wide char
        if (cell.width === 0 && x > 0) {
            const head = this.cells[idx - 1];
            if (head.width === 2) {
                head.char = " ";
                head.width = 1;
            }
        }
        // If overwriting a head cell of a wide char, clear its continuation
        if (cell.width === 2 && x + 1 < this.size.width) {
            const cont = this.cells[idx + 1];
            if (cont.width === 0) {
                cont.char = " ";
                cont.width = 1;
            }
        }

        cell.char = char;
        cell.fg = fg;
        cell.bg = bg;
        cell.style = style;
        cell.width = width;

        // For wide chars, set up the continuation cell
        if (width === 2 && x + 1 < this.size.width) {
            const cont = this.cells[idx + 1];
            // If the continuation position holds a wide char head, clear its own continuation
            if (cont.width === 2 && x + 2 < this.size.width) {
                const nextCont = this.cells[idx + 2];
                if (nextCont.width === 0) {
                    nextCont.char = " ";
                    nextCont.width = 1;
                }
            }
            cont.char = "";
            cont.fg = fg;
            cont.bg = bg;
            cont.style = style;
            cont.width = 0;
        }
    }

    public updateCell(position: Point, patch: CellPatch): void {
        const x = position.x;
        const y = position.y;
        const w = this.size.width;
        const idx = y * w + x;
        const cell = this.cells[idx];

        // Wide-char bookkeeping only when char or width are being set
        if (patch.char !== undefined || patch.width !== undefined) {
            // If overwriting a continuation cell, clear the head cell of that wide char
            if (cell.width === 0 && x > 0) {
                const head = this.cells[idx - 1];
                if (head.width === 2) {
                    head.char = " ";
                    head.width = 1;
                }
            }
            // If overwriting a head cell of a wide char, clear its continuation
            if (cell.width === 2 && x + 1 < w) {
                const cont = this.cells[idx + 1];
                if (cont.width === 0) {
                    cont.char = " ";
                    cont.width = 1;
                }
            }
        }

        if (patch.char !== undefined) cell.char = patch.char;
        if (patch.fg !== undefined) cell.fg = patch.fg;
        if (patch.bg !== undefined) cell.bg = patch.bg;
        if (patch.style !== undefined) cell.style = patch.style;
        if (patch.width !== undefined) cell.width = patch.width;

        // For wide chars, set up the continuation cell
        const newWidth = patch.width ?? cell.width;
        if (newWidth === 2 && x + 1 < w) {
            const cont = this.cells[idx + 1];
            // If the continuation position holds a wide char head, clear its own continuation
            if (cont.width === 2 && x + 2 < w) {
                const nextCont = this.cells[idx + 2];
                if (nextCont.width === 0) {
                    nextCont.char = " ";
                    nextCont.width = 1;
                }
            }
            cont.char = "";
            cont.width = 0;
            if (patch.fg !== undefined) cont.fg = patch.fg;
            if (patch.bg !== undefined) cont.bg = patch.bg;
            if (patch.style !== undefined) cont.style = patch.style;
        }
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
            cell.width = 1;
        }
    }
}
