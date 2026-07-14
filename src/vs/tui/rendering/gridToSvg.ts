import { DEFAULT_COLOR, unpackB, unpackG, unpackR } from "../../base/common/color.ts";
import type { GridSnapshot } from "./gridSnapshot.ts";
import { StyleFlags } from "./styleFlags.ts";

/**
 * Options for {@link gridToSvg}. Colours are packed 24-bit RGB. Metrics are in
 * pixels; the cell grid is drawn on a fixed lattice so every run lands exactly on
 * `col * cellWidth` regardless of the viewer's font advance.
 */
export interface GridToSvgOptions {
    cellWidth?: number;
    cellHeight?: number;
    fontSize?: number;
    /** Vertical baseline offset inside a cell (0 = top). */
    baseline?: number;
    /** Font family used for glyphs. For PNG rendering pass a concrete family. */
    fontFamily?: string;
    /** Resolves cells whose fg is `DEFAULT_COLOR`. */
    defaultFg?: number;
    /** Resolves cells whose bg is `DEFAULT_COLOR`, and paints the page background. */
    defaultBg?: number;
}

interface ResolvedOptions {
    cellWidth: number;
    cellHeight: number;
    fontSize: number;
    baseline: number;
    fontFamily: string;
    defaultFg: number;
    defaultBg: number;
}

// VS Code Dark+ editor foreground / background.
const DEFAULT_FG = 0xd4d4d4;
const DEFAULT_BG = 0x1e1e1e;

function resolveOptions(options: GridToSvgOptions): ResolvedOptions {
    const cellHeight = options.cellHeight ?? 18;
    return {
        cellWidth: options.cellWidth ?? 9,
        cellHeight,
        fontSize: options.fontSize ?? 15,
        baseline: options.baseline ?? Math.round(cellHeight * 0.76),
        fontFamily: options.fontFamily ?? "monospace",
        defaultFg: options.defaultFg ?? DEFAULT_FG,
        defaultBg: options.defaultBg ?? DEFAULT_BG,
    };
}

function toHex(color: number): string {
    const r = unpackR(color).toString(16).padStart(2, "0");
    const g = unpackG(color).toString(16).padStart(2, "0");
    const b = unpackB(color).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
}

function resolveColor(color: number, fallback: number): number {
    return color === DEFAULT_COLOR ? fallback : color;
}

function escapeXml(text: string): string {
    return text.replace(/[&<>]/gu, (ch) => (ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : "&gt;"));
}

function styleAttrs(style: number): string {
    const attrs: string[] = [];
    if ((style & StyleFlags.Bold) !== 0) attrs.push(`font-weight="bold"`);
    if ((style & StyleFlags.Italic) !== 0) attrs.push(`font-style="italic"`);
    const decorations: string[] = [];
    if ((style & (StyleFlags.Underline | StyleFlags.Undercurl)) !== 0) decorations.push("underline");
    if ((style & StyleFlags.Strikethrough) !== 0) decorations.push("line-through");
    if (decorations.length > 0) attrs.push(`text-decoration="${decorations.join(" ")}"`);
    if ((style & StyleFlags.Dim) !== 0) attrs.push(`opacity="0.6"`);
    return attrs.length > 0 ? " " + attrs.join(" ") : "";
}

const TEXT_STYLE_MASK = ~StyleFlags.Inverse;

/**
 * Render a {@link GridSnapshot} into a standalone, self-contained SVG string.
 *
 * Pure — no fonts, no libraries, no I/O. Background is drawn as merged per-row
 * rects; glyphs as per-run `<text>` with `textLength`/`lengthAdjust` so the run
 * fills exactly its column span (grid stays aligned under any font). `Inverse`
 * swaps fg/bg per cell; wide cells (`width === 2`) span two columns and their
 * continuation (`width === 0`) is skipped.
 */
export function gridToSvg(snapshot: GridSnapshot, options: GridToSvgOptions = {}): string {
    const opts = resolveOptions(options);
    const { cols, rows, cells } = snapshot;
    const width = cols * opts.cellWidth;
    const height = rows * opts.cellHeight;

    const parts: string[] = [];
    parts.push(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
            `viewBox="0 0 ${width} ${height}" font-family="${escapeXml(opts.fontFamily)}" ` +
            `font-size="${opts.fontSize}">`,
    );
    parts.push(`<rect width="${width}" height="${height}" fill="${toHex(opts.defaultBg)}"/>`);

    // Effective per-cell colours with Inverse applied and defaults resolved.
    const effFg = new Array<number>(cells.length);
    const effBg = new Array<number>(cells.length);
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        let fg = resolveColor(cell.fg, opts.defaultFg);
        let bg = resolveColor(cell.bg, opts.defaultBg);
        if ((cell.style & StyleFlags.Inverse) !== 0) {
            const tmp = fg;
            fg = bg;
            bg = tmp;
        }
        effFg[i] = fg;
        effBg[i] = bg;
    }

    // Background: merge horizontal runs of identical bg per row; skip page default.
    for (let y = 0; y < rows; y++) {
        let x = 0;
        while (x < cols) {
            const bg = effBg[y * cols + x];
            let end = x;
            while (end + 1 < cols && effBg[y * cols + end + 1] === bg) end++;
            if (bg !== opts.defaultBg) {
                const rx = x * opts.cellWidth;
                const rw = (end - x + 1) * opts.cellWidth;
                parts.push(
                    `<rect x="${rx}" y="${y * opts.cellHeight}" width="${rw}" height="${opts.cellHeight}" fill="${toHex(bg)}"/>`,
                );
            }
            x = end + 1;
        }
    }

    // Text: merge contiguous glyph cells sharing fg + text-style into one <text>.
    for (let y = 0; y < rows; y++) {
        let x = 0;
        let runStartCol = -1;
        let runCols = 0;
        let runText = "";
        let runFg = 0;
        let runStyle = 0;

        const flush = (): void => {
            if (runStartCol >= 0 && runText.length > 0) {
                const tx = runStartCol * opts.cellWidth;
                const ty = y * opts.cellHeight + opts.baseline;
                const tl = runCols * opts.cellWidth;
                parts.push(
                    `<text x="${tx}" y="${ty}" textLength="${tl}" lengthAdjust="spacingAndGlyphs" ` +
                        `fill="${toHex(runFg)}"${styleAttrs(runStyle)}>${escapeXml(runText)}</text>`,
                );
            }
            runStartCol = -1;
            runCols = 0;
            runText = "";
        };

        while (x < cols) {
            const cell = cells[y * cols + x];
            const advance = cell.width === 0 ? 1 : cell.width;
            const isGlyph = cell.width !== 0 && cell.char !== " " && cell.char !== "";
            if (!isGlyph) {
                flush();
                x += advance;
                continue;
            }
            const fg = effFg[y * cols + x];
            const style = cell.style & TEXT_STYLE_MASK;
            if (runStartCol >= 0 && (fg !== runFg || style !== runStyle || runStartCol + runCols !== x)) {
                flush();
            }
            if (runStartCol < 0) {
                runStartCol = x;
                runFg = fg;
                runStyle = style;
            }
            runText += cell.char;
            runCols += cell.width;
            x += cell.width;
        }
        flush();
    }

    parts.push(`</svg>`);
    return parts.join("");
}
