import type { Point } from "../../base/common/geometry.ts";

import { DEFAULT_COLOR } from "../../base/common/color.ts";
import type { Grid } from "./grid.ts";

/**
 * Plain-data snapshot of a single rendered {@link Grid} cell. Colours are packed
 * 24-bit RGB or the `DEFAULT_COLOR` sentinel; `style` is a `StyleFlags` bitmask;
 * `width` mirrors {@link Grid} cell width (1 normal, 2 wide head, 0 continuation).
 */
export interface CellSnapshot {
    char: string;
    fg: number;
    bg: number;
    style: number;
    width: number;
}

/**
 * Serialized terminal frame: everything needed to re-draw the screen elsewhere
 * (an image rasterizer, a diff viewer) without a terminal. Pure data — safe to
 * JSON-encode and send over the inspector protocol. `cells` is row-major with
 * `cols * rows` entries.
 */
export interface GridSnapshot {
    cols: number;
    rows: number;
    cursor: { x: number; y: number } | null;
    cells: CellSnapshot[];
}

/** Freeze the current state of `grid` (plus cursor) into a {@link GridSnapshot}. */
export function snapshotGrid(grid: Grid, cursor: Point | null): GridSnapshot {
    const { width: cols, height: rows } = grid;
    const cells: CellSnapshot[] = new Array<CellSnapshot>(cols * rows);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = grid.getCellAt(x, y);
            cells[y * cols + x] = {
                char: cell.char,
                fg: cell.fg,
                bg: cell.bg,
                style: cell.style,
                width: cell.width,
            };
        }
    }
    return {
        cols,
        rows,
        cursor: cursor === null ? null : { x: cursor.x, y: cursor.y },
        cells,
    };
}

/** An empty snapshot of the given size — used before the first frame is rendered. */
export function emptyGridSnapshot(cols: number, rows: number): GridSnapshot {
    const cells: CellSnapshot[] = new Array<CellSnapshot>(cols * rows);
    for (let i = 0; i < cells.length; i++) {
        cells[i] = { char: " ", fg: DEFAULT_COLOR, bg: DEFAULT_COLOR, style: 0, width: 1 };
    }
    return { cols, rows, cursor: null, cells };
}
