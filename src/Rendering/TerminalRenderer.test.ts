import { describe, expect, it } from "vitest";
import { TerminalRenderer } from "./TerminalRenderer.ts";
import { Grid } from "./Grid.ts";
import { packRgb, DEFAULT_COLOR } from "./ColorUtils.ts";
import { StyleFlags } from "./StyleFlags.ts";
import { Point, Size } from "../Common/GeometryPromitives.ts";

/**
 * Captures all output written by TerminalRenderer into a string.
 */
function createCapture(): { output: string; writer: { write(data: string): void } } {
    const state = { output: "" };
    return {
        get output() {
            return state.output;
        },
        writer: {
            write(data: string) {
                state.output += data;
            },
        },
    };
}

/**
 * Replace raw ESC (\x1b) with readable «ESC» for snapshot readability.
 */
function humanize(raw: string): string {
    // eslint-disable-next-line no-control-regex
    return raw.replace(/\x1b/g, "ESC");
}

describe("TerminalRenderer", () => {
    // ── Lifecycle ────────────────────────────────────────────────

    describe("setup / destroy", () => {
        it("setup emits alternate-screen + hide-cursor", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);
            renderer.setup();
            expect(humanize(cap.output)).toMatchInlineSnapshot(`"ESC[?1049hESC[?25l"`);
        });

        it("destroy emits show-cursor + normal-screen", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);
            renderer.destroy();
            expect(humanize(cap.output)).toMatchInlineSnapshot(`"ESC[?25hESC[?1049l"`);
        });
    });

    // ── Diffing ──────────────────────────────────────────────────

    describe("diffing: only changed cells are emitted", () => {
        it("produces no output when grids are identical", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);
            const a = new Grid(new Size(3, 2));
            const b = new Grid(new Size(3, 2));
            // Make both grids identical by syncing previous to current
            b.copyAllCellsFrom(a);
            renderer.render(a, b);
            expect(cap.output).toBe("");
        });

        it("emits only the changed cell", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(3, 1));
            const previous = new Grid(new Size(3, 1));

            // Change only the middle cell
            current.setCell(new Point(1, 0), "X");

            renderer.render(current, previous);
            // Should see: cursor-to(1,0) + reset + "X" + trailing reset
            expect(humanize(cap.output)).toMatchInlineSnapshot(`"ESC[1;2HESC[0mX"`);
        });

        it("does not re-emit on second render if nothing changed", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(2, 1));
            const previous = new Grid(new Size(2, 1));
            current.setCell(new Point(0, 0), "A");

            renderer.render(current, previous);
            const firstOutput = cap.output;

            // Reset capture
            cap.writer.write(""); // noop
            const cap2 = createCapture();
            const renderer2 = new TerminalRenderer(cap2.writer);

            // previous was updated in-place by first render — should match current now
            renderer2.render(current, previous);
            expect(cap2.output).toBe("");
        });
    });

    // ── Cursor optimization ──────────────────────────────────────

    describe("cursor positioning", () => {
        it("skips CUP for consecutive cells on the same row", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(4, 1));
            const previous = new Grid(new Size(4, 1));
            current.setCell(new Point(0, 0), "A");
            current.setCell(new Point(1, 0), "B");
            current.setCell(new Point(2, 0), "C");

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // Only one CUP at the beginning (1;1H), then A B C without extra CUP
            expect(h).toMatchInlineSnapshot(`"ESC[1;1HESC[0mABC"`);
        });

        it("emits CUP when there is a gap between changed cells", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(5, 1));
            const previous = new Grid(new Size(5, 1));
            current.setCell(new Point(0, 0), "A");
            // cell 1 unchanged
            current.setCell(new Point(2, 0), "C");

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // CUP to (0,0), then "A", then CUP to (2,0), then "C"
            expect(h).toMatchInlineSnapshot(`"ESC[1;1HESC[0mAESC[1;3HC"`);
        });

        it("emits CUP when row changes", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(2, 2));
            const previous = new Grid(new Size(2, 2));
            current.setCell(new Point(0, 0), "A");
            current.setCell(new Point(0, 1), "B");

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // CUP to row 1 col 1, "A", CUP to row 2 col 1, "B"
            expect(h).toMatchInlineSnapshot(`"ESC[1;1HESC[0mAESC[2;1HB"`);
        });
    });

    // ── Color SGR ────────────────────────────────────────────────

    describe("TrueColor SGR sequences", () => {
        it("emits foreground color as 38;2;R;G;B", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), "R", packRgb(255, 0, 0));

            renderer.render(current, previous);
            const h = humanize(cap.output);

            expect(h).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[38;2;255;0;0mRESC[0m"`);
        });

        it("emits background color as 48;2;R;G;B", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), " ", DEFAULT_COLOR, packRgb(0, 128, 255));

            renderer.render(current, previous);
            const h = humanize(cap.output);

            expect(h).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[48;2;0;128;255m ESC[0m"`);
        });

        it("emits both fg and bg when both are set", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), "X", packRgb(255, 255, 0), packRgb(0, 0, 128));

            renderer.render(current, previous);
            const h = humanize(cap.output);

            expect(h).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[38;2;255;255;0mESC[48;2;0;0;128mXESC[0m"`);
        });
    });

    // ── State machine: no redundant SGR ──────────────────────────

    describe("state machine avoids redundant SGR", () => {
        it("does not re-emit fg color for consecutive cells with same fg", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const red = packRgb(255, 0, 0);
            const current = new Grid(new Size(3, 2));
            const previous = new Grid(new Size(3, 2));
            current.setCell(new Point(0, 0), "A", red);
            current.setCell(new Point(1, 0), "B", red);
            current.setCell(new Point(2, 0), "C", red);

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // fg(255,0,0) should appear only once, not three times
            expect(h).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[38;2;255;0;0mABCESC[0m"`);
        });

        it("emits new fg only when color changes mid-row", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const red = packRgb(255, 0, 0);
            const green = packRgb(0, 255, 0);
            const current = new Grid(new Size(3, 2));
            const previous = new Grid(new Size(3, 2));
            current.setCell(new Point(0, 0), "R", red);
            current.setCell(new Point(1, 0), "G", green);
            current.setCell(new Point(2, 0), "R", red);

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // Should see: fg red, "R", fg green, "G", fg red, "R"
            expect(h).toMatchInlineSnapshot(
                `"ESC[1;1HESC[0mESC[38;2;255;0;0mRESC[38;2;0;255;0mGESC[38;2;255;0;0mRESC[0m"`,
            );
        });

        it("resets to default fg via SGR 39", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const red = packRgb(255, 0, 0);
            const current = new Grid(new Size(2, 2));
            const previous = new Grid(new Size(2, 2));
            current.setCell(new Point(0, 0), "R", red);
            current.setCell(new Point(1, 0), "D"); // DEFAULT_COLOR fg

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // After red cell, default-fg cell should emit ESC[39m
            expect(h).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[38;2;255;0;0mRESC[39mD"`);
        });

        it("resets to default bg via SGR 49", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const blue = packRgb(0, 0, 255);
            const current = new Grid(new Size(2, 2));
            const previous = new Grid(new Size(2, 2));
            current.setCell(new Point(0, 0), "B", DEFAULT_COLOR, blue);
            current.setCell(new Point(1, 0), "D"); // DEFAULT_COLOR bg

            renderer.render(current, previous);
            const h = humanize(cap.output);

            expect(h).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[48;2;0;0;255mBESC[49mD"`);
        });
    });

    // ── Style flags SGR ──────────────────────────────────────────

    describe("style flags produce correct SGR codes", () => {
        it("Bold → SGR 1", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);
            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), "B", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.Bold);

            renderer.render(current, previous);
            expect(humanize(cap.output)).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[1mBESC[0m"`);
        });

        it("Dim → SGR 2", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);
            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), "D", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.Dim);

            renderer.render(current, previous);
            expect(humanize(cap.output)).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[2mDESC[0m"`);
        });

        it("Italic → SGR 3", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);
            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), "I", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.Italic);

            renderer.render(current, previous);
            expect(humanize(cap.output)).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[3mIESC[0m"`);
        });

        it("Underline → SGR 4", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);
            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), "U", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.Underline);

            renderer.render(current, previous);
            expect(humanize(cap.output)).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[4mUESC[0m"`);
        });

        it("Undercurl → SGR 4:3", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);
            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), "~", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.Undercurl);

            renderer.render(current, previous);
            expect(humanize(cap.output)).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[4:3m~ESC[0m"`);
        });

        it("Inverse → SGR 7", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);
            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), "V", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.Inverse);

            renderer.render(current, previous);
            expect(humanize(cap.output)).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[7mVESC[0m"`);
        });

        it("Strikethrough → SGR 9", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);
            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), "S", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.Strikethrough);

            renderer.render(current, previous);
            expect(humanize(cap.output)).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[9mSESC[0m"`);
        });

        it("combined Bold + Italic → SGR 1 then SGR 3", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);
            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), "X", DEFAULT_COLOR, DEFAULT_COLOR, StyleFlags.Bold | StyleFlags.Italic);

            renderer.render(current, previous);
            expect(humanize(cap.output)).toMatchInlineSnapshot(`"ESC[1;1HESC[0mESC[1mESC[3mXESC[0m"`);
        });
    });

    // ── Style change triggers full reset ─────────────────────────

    describe("style change triggers full SGR reset", () => {
        it("resets and re-applies when style changes mid-row", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const white = packRgb(255, 255, 255);
            const current = new Grid(new Size(2, 2));
            const previous = new Grid(new Size(2, 2));
            current.setCell(new Point(0, 0), "B", white, DEFAULT_COLOR, StyleFlags.Bold);
            current.setCell(new Point(1, 0), "I", white, DEFAULT_COLOR, StyleFlags.Italic);

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // After "B" (bold, white fg), switching to italic should:
            // 1. ESC[0m (reset) 2. ESC[3m (italic) 3. ESC[38;2;255;255;255m (re-apply fg)
            expect(h).toMatchInlineSnapshot(
                `"ESC[1;1HESC[0mESC[1mESC[38;2;255;255;255mBESC[0mESC[3mESC[38;2;255;255;255mIESC[0m"`,
            );
        });
    });

    // ── Full scene snapshot ──────────────────────────────────────

    describe("full scene snapshot", () => {
        it("renders a 4×2 grid with mixed colors and styles", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const red = packRgb(255, 0, 0);
            const blue = packRgb(0, 0, 255);
            const green = packRgb(0, 200, 0);

            const current = new Grid(new Size(4, 3));
            const previous = new Grid(new Size(4, 3));

            // Row 0: "Hi" in red bold, then "!!" in green
            current.setCell(new Point(0, 0), "H", red, DEFAULT_COLOR, StyleFlags.Bold);
            current.setCell(new Point(1, 0), "i", red, DEFAULT_COLOR, StyleFlags.Bold);
            current.setCell(new Point(2, 0), "!", green);
            current.setCell(new Point(3, 0), "!", green);

            // Row 1: "  " with blue bg, then "OK" default
            current.setCell(new Point(0, 1), " ", DEFAULT_COLOR, blue);
            current.setCell(new Point(1, 1), " ", DEFAULT_COLOR, blue);
            current.setCell(new Point(2, 1), "O");
            current.setCell(new Point(3, 1), "K");

            renderer.render(current, previous);

            expect(humanize(cap.output)).toMatchInlineSnapshot(
                `"ESC[1;1HESC[0mESC[1mESC[38;2;255;0;0mHiESC[0mESC[38;2;0;200;0m!!ESC[2;1HESC[39mESC[48;2;0;0;255m  ESC[49mOK"`,
            );
        });
    });

    // ── previousGrid is updated in-place ─────────────────────────

    describe("previousGrid update", () => {
        it("updates previousGrid cells in-place after render", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(2, 2));
            const previous = new Grid(new Size(2, 2));
            current.setCell(new Point(0, 0), "A", packRgb(1, 2, 3));
            current.setCell(new Point(1, 0), "B", packRgb(4, 5, 6));

            renderer.render(current, previous);

            // After render, previous should mirror current
            expect(previous.getCell(new Point(0, 0)).char).toBe("A");
            expect(previous.getCell(new Point(0, 0)).fg).toBe(packRgb(1, 2, 3));
            expect(previous.getCell(new Point(1, 0)).char).toBe("B");
            expect(previous.getCell(new Point(1, 0)).fg).toBe(packRgb(4, 5, 6));
        });
    });

    // ── Trailing reset ───────────────────────────────────────────

    describe("trailing SGR reset", () => {
        it("appends ESC[0m when last emitted cell has non-default attributes", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), "X", packRgb(255, 0, 0));

            renderer.render(current, previous);
            expect(cap.output.endsWith("\x1b[0m")).toBe(true);
        });

        it("does not append trailing reset when all cells are default-colored", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(1, 2));
            const previous = new Grid(new Size(1, 2));
            current.setCell(new Point(0, 0), "X");

            renderer.render(current, previous);
            const h = humanize(cap.output);
            // Reset at start (style change from sentinel), char, then trailing reset
            // Actually: the state machine starts with activeStyle=-1, first cell style=0,
            // so it WILL emit a reset. After the char, activeFg/Bg are DEFAULT, activeStyle is 0
            // → no trailing reset needed... but the initial reset already changed activeStyle to 0.
            // Let me check: after initial reset, activeFg=DEFAULT_COLOR, activeBg=DEFAULT_COLOR,
            // activeStyle=None. The cell has all defaults, so the trailing check:
            // activeStyle !== None || activeFg !== DEFAULT || activeBg !== DEFAULT → all false → no trailing reset.
            // But wait, we DID emit a reset at the start, so the output ends with "X", not ESC[0m.
            // Actually the initial sentinel triggers the reset path too... let me just snapshot it.
            expect(h).toMatchInlineSnapshot(`"ESC[1;1HESC[0mX"`);
        });
    });

    // ── Right-edge fixes ─────────────────────────────────────────

    describe("right-edge rendering fixes", () => {
        it("skips bottom-right corner cell to prevent hardware scroll", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(3, 2));
            const previous = new Grid(new Size(3, 2));

            // Change a normal cell and the bottom-right corner
            current.setCell(new Point(0, 0), "A");
            current.setCell(new Point(2, 1), "Z"); // bottom-right corner

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // "A" should be rendered, but "Z" at (2,1) must NOT appear
            expect(h).toContain("A");
            expect(h).not.toContain("Z");

            // previousGrid must NOT be updated for the skipped corner cell
            expect(previous.getCell(new Point(2, 1)).char).toBe(" ");
        });

        it("invalidates cursor after writing to rightmost column", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            // 3 columns, 2 rows
            const current = new Grid(new Size(3, 2));
            const previous = new Grid(new Size(3, 2));

            // Change last column of row 0 and first column of row 1
            current.setCell(new Point(2, 0), "R");
            current.setCell(new Point(0, 1), "L");

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // After "R" at col 2 (rightmost), cursor state is invalidated.
            // So "L" at (0,1) MUST get an explicit CUP sequence even though
            // a naive auto-advance might place the cursor there.
            // Expect: CUP(1,3) + reset + "R" + CUP(2,1) + "L"
            expect(h).toMatchInlineSnapshot(`"ESC[1;3HESC[0mRESC[2;1HL"`);
        });
    });
});
