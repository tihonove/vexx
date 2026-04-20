import { describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";

import { Grid } from "./Grid.ts";
import { TerminalRenderer } from "./TerminalRenderer.ts";

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

function humanize(raw: string): string {
    // eslint-disable-next-line no-control-regex
    return raw.replace(/\x1b/g, "ESC");
}

describe("TerminalRenderer — wide character support", () => {
    describe("cursor advancement for wide chars", () => {
        it("skips CUP after a wide char (cursor advances by 2)", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(5, 1));
            const previous = new Grid(new Size(5, 1));
            // Wide char at 0-1, normal char at 2
            current.setCell(new Point(0, 0), "漢", undefined, undefined, 0, 2);
            current.setCell(new Point(2, 0), "A");

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // Should see: CUP(1;1) + reset + "漢" + "A" (no extra CUP between them)
            // The continuation cell at x=1 is skipped, and cursor auto-advanced
            // from 0 to 2 after writing the wide char.
            expect(h).toContain("漢A");
            // No CUP between 漢 and A
            expect(h).not.toContain("HESC[0mAESC");
        });

        it("emits CUP when there is a gap after a wide char", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(6, 1));
            const previous = new Grid(new Size(6, 1));
            current.setCell(new Point(0, 0), "漢", undefined, undefined, 0, 2);
            // Skip cell 2, write at 3
            current.setCell(new Point(3, 0), "B");

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // Should have a CUP before "B" since cursor is at x=2 after writing 漢
            // but B is at x=3
            expect(h).toContain("漢");
            expect(h).toContain("ESC[1;4HB"); // CUP to col 4 (1-based)
        });
    });

    describe("skipping continuation cells", () => {
        it("does not emit anything for continuation cells (width=0)", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(4, 1));
            const previous = new Grid(new Size(4, 1));
            current.setCell(new Point(0, 0), "漢", undefined, undefined, 0, 2);

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // Should only emit the head char, not the continuation
            expect(h).toContain("漢");
            // The empty continuation char should not appear
            const charParts = h.replace(/ESC\[[^a-zA-Z]*[a-zA-Z]/g, "");
            expect(charParts).toBe("漢");
        });
    });

    describe("consecutive wide chars", () => {
        it("renders two consecutive wide chars without extra CUP", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(6, 1));
            const previous = new Grid(new Size(6, 1));
            current.setCell(new Point(0, 0), "漢", undefined, undefined, 0, 2);
            current.setCell(new Point(2, 0), "字", undefined, undefined, 0, 2);

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // Both chars should appear consecutively without CUP between them
            expect(h).toContain("漢字");
        });
    });

    describe("diff with wide chars", () => {
        it("does not re-emit unchanged wide char on second render", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(4, 1));
            const previous = new Grid(new Size(4, 1));
            current.setCell(new Point(0, 0), "漢", undefined, undefined, 0, 2);

            renderer.render(current, previous);

            // Second render — nothing changed
            const cap2 = createCapture();
            const renderer2 = new TerminalRenderer(cap2.writer);
            renderer2.render(current, previous);

            expect(cap2.output).toBe("");
        });

        it("re-emits when wide char changes to a different wide char", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(4, 1));
            const previous = new Grid(new Size(4, 1));
            current.setCell(new Point(0, 0), "漢", undefined, undefined, 0, 2);
            renderer.render(current, previous);

            // Change to a different wide char
            current.setCell(new Point(0, 0), "字", undefined, undefined, 0, 2);
            const cap2 = createCapture();
            const renderer2 = new TerminalRenderer(cap2.writer);
            renderer2.render(current, previous);

            expect(cap2.output).toContain("字");
        });
    });

    describe("wide chars with normal chars", () => {
        it("renders mixed line: normal + wide + normal", () => {
            const cap = createCapture();
            const renderer = new TerminalRenderer(cap.writer);

            const current = new Grid(new Size(6, 1));
            const previous = new Grid(new Size(6, 1));
            current.setCell(new Point(0, 0), "A");
            current.setCell(new Point(1, 0), "漢", undefined, undefined, 0, 2);
            current.setCell(new Point(3, 0), "B");

            renderer.render(current, previous);
            const h = humanize(cap.output);

            // All chars should be present without unnecessary CUPs
            expect(h).toContain("A漢B");
        });
    });
});
