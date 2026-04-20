import { DEFAULT_COLOR, unpackB, unpackG, unpackR } from "./ColorUtils.ts";
import type { Grid } from "./Grid.ts";
import { StyleFlags } from "./StyleFlags.ts";

/** Minimal writable interface so we can inject a test double instead of real stdout. */
export interface WritableOutput {
    write(data: string): void;
}

/**
 * High-performance terminal renderer.
 *
 * - On `setup()` switches to Alternate Screen Buffer and hides the cursor.
 * - On `destroy()` restores the original screen and shows the cursor.
 * - `render(current, previous)` diffs two grids, emits minimal ANSI escape
 *   sequences via an internal state machine, and flushes exactly one
 *   `stdout.write()` per frame.
 */
export class TerminalRenderer {
    private readonly out: WritableOutput;

    public constructor(out: WritableOutput = process.stdout) {
        this.out = out;
    }

    // ── Lifecycle ────────────────────────────────────────────────

    public setup(): void {
        this.out.write(
            "\x1b[?1049h" + // alternate screen buffer
                "\x1b[?25l", // hide cursor
        );
    }

    public destroy(): void {
        this.out.write(
            "\x1b[?25h" + // show cursor
                "\x1b[?1049l", // normal screen buffer
        );
    }

    // ── Render ───────────────────────────────────────────────────

    /**
     * Diff `currentGrid` against `previousGrid`, emit only changed cells,
     * then update `previousGrid` in-place so it mirrors `currentGrid` for the
     * next frame.
     *
     * Exactly one `stdout.write()` at the end.
     */
    public render(currentGrid: Grid, previousGrid: Grid): void {
        const width = currentGrid.width;
        const height = currentGrid.height;

        let buf = "";

        // State machine: track what the terminal "thinks" is active so we
        // only emit SGR codes when something actually changes.
        let activeFg = -2; // impossible sentinel — forces first emission
        let activeBg = -2;
        let activeStyle = -1; // impossible sentinel
        let cursorX = -1; // current cursor column (0-based, -1 = unknown)
        let cursorY = -1;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Skip bottom-right corner: writing here triggers hardware scroll.
                if (x === width - 1 && y === height - 1) continue;

                if (currentGrid.cellEqualsAt(x, y, previousGrid)) continue;

                const cur = currentGrid.getCellAt(x, y);

                // Skip continuation cells (second column of a wide character).
                // The head cell already wrote the character, and the terminal
                // auto-advanced the cursor past the continuation column.
                if (cur.width === 0) {
                    previousGrid.copyCellFrom(x, y, currentGrid);
                    continue;
                }

                // ── Cursor positioning ──────────────────────────
                // If the cursor is already at (x, y) we can skip the CUP sequence.
                // After writing a character the cursor auto-advances by one column.
                if (cursorY !== y || cursorX !== x) {
                    buf += `\x1b[${(y + 1).toString()};${(x + 1).toString()}H`;
                }

                // ── SGR (Select Graphic Rendition) ──────────────
                const needFg = cur.fg;
                const needBg = cur.bg;
                const needStyle = cur.style;

                if (needStyle !== activeStyle) {
                    // Style changed — cheapest strategy: full reset + re-apply everything.
                    buf += "\x1b[0m";
                    // activeFg = DEFAULT_COLOR;
                    // activeBg = DEFAULT_COLOR;
                    activeStyle = StyleFlags.None;

                    if (needStyle !== StyleFlags.None) {
                        buf += styleToSgr(needStyle);
                        activeStyle = needStyle;
                    }

                    // After reset we must re-emit colors even if they haven't changed,
                    // because the reset wiped them.
                    if (needFg !== DEFAULT_COLOR) {
                        buf += fgSgr(needFg);
                    }
                    activeFg = needFg;

                    if (needBg !== DEFAULT_COLOR) {
                        buf += bgSgr(needBg);
                    }
                    activeBg = needBg;
                } else {
                    // Style unchanged — update colors individually.
                    if (needFg !== activeFg) {
                        buf += needFg === DEFAULT_COLOR ? "\x1b[39m" : fgSgr(needFg);
                        activeFg = needFg;
                    }
                    if (needBg !== activeBg) {
                        buf += needBg === DEFAULT_COLOR ? "\x1b[49m" : bgSgr(needBg);
                        activeBg = needBg;
                    }
                }

                // ── Character ───────────────────────────────────
                buf += cur.char;

                // Update cursor tracking (character auto-advances).
                // Wide characters (width=2) advance the cursor by 2 columns.
                const charWidth = cur.width;
                if (x + charWidth >= width) {
                    // Right margin: terminal behaviour is unpredictable after
                    // writing the last column (may or may not auto-wrap).
                    // Invalidate cursor so the next cell gets an absolute CUP.
                    cursorX = -1;
                    cursorY = -1;
                } else {
                    cursorX = x + charWidth;
                    cursorY = y;
                }

                // Update previous-frame buffer so the next render sees no diff.
                previousGrid.copyCellFrom(x, y, currentGrid);
            }
        }

        // Reset SGR at the end of the frame so we don't leave the terminal
        // in a weird state between frames. Only if we actually emitted any cells.
        if (
            buf.length > 0 &&
            (activeStyle !== StyleFlags.None || activeFg !== DEFAULT_COLOR || activeBg !== DEFAULT_COLOR)
        ) {
            buf += "\x1b[0m";
        }

        if (buf.length > 0) {
            this.out.write(buf);
        }
    }
}

// ── SGR helpers  ─────────────────────────────────────────────────

function fgSgr(packedRgb: number): string {
    return `\x1b[38;2;${unpackR(packedRgb).toString()};${unpackG(packedRgb).toString()};${unpackB(packedRgb).toString()}m`;
}

function bgSgr(packedRgb: number): string {
    return `\x1b[48;2;${unpackR(packedRgb).toString()};${unpackG(packedRgb).toString()};${unpackB(packedRgb).toString()}m`;
}

/**
 * Convert a StyleFlags bitmask to the corresponding SGR escape sequence(s).
 * Returns a single concatenated string (e.g. `"\x1b[1m\x1b[3m"` for Bold+Italic).
 */
function styleToSgr(flags: number): string {
    let s = "";
    if (flags & StyleFlags.Bold) s += "\x1b[1m";
    if (flags & StyleFlags.Dim) s += "\x1b[2m";
    if (flags & StyleFlags.Italic) s += "\x1b[3m";
    if (flags & StyleFlags.Underline) s += "\x1b[4m";
    if (flags & StyleFlags.Undercurl) s += "\x1b[4:3m";
    if (flags & StyleFlags.Inverse) s += "\x1b[7m";
    if (flags & StyleFlags.Strikethrough) s += "\x1b[9m";
    return s;
}
