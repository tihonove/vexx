import { describe, expect, it } from "vitest";

import { DEFAULT_COLOR, packRgb } from "../../base/common/colorUtils.ts";
import type { CellSnapshot, GridSnapshot } from "./gridSnapshot.ts";
import { gridToSvg } from "./gridToSvg.ts";
import { StyleFlags } from "../../base/common/styleFlags.ts";

function cell(partial: Partial<CellSnapshot>): CellSnapshot {
    return { char: " ", fg: DEFAULT_COLOR, bg: DEFAULT_COLOR, style: 0, width: 1, ...partial };
}

function snapshot(rows: CellSnapshot[][]): GridSnapshot {
    const cols = rows[0].length;
    return {
        cols,
        rows: rows.length,
        cursor: null,
        cells: rows.flat(),
    };
}

describe("gridToSvg", () => {
    it("emits an svg sized cols*rows by cell metrics with a page background", () => {
        const svg = gridToSvg(snapshot([[cell({}), cell({})]]), { cellWidth: 10, cellHeight: 20 });
        expect(svg).toContain(`width="20" height="20"`);
        expect(svg).toContain(`viewBox="0 0 20 20"`);
        // Default page background is VS Code Dark+ #1e1e1e.
        expect(svg).toContain(`<rect width="20" height="20" fill="#1e1e1e"/>`);
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg.endsWith("</svg>")).toBe(true);
    });

    it("honours custom font family and colours", () => {
        const svg = gridToSvg(snapshot([[cell({ char: "x" })]]), {
            fontFamily: "Hack Nerd Font Mono",
            defaultFg: packRgb(1, 2, 3),
            defaultBg: packRgb(4, 5, 6),
        });
        expect(svg).toContain(`font-family="Hack Nerd Font Mono"`);
        expect(svg).toContain(`fill="#040506"`); // page bg
        expect(svg).toContain(`fill="#010203"`); // glyph fg (resolved default)
    });

    it("renders a glyph as a positioned text run with textLength", () => {
        const svg = gridToSvg(snapshot([[cell({ char: "A", fg: packRgb(10, 20, 30) })]]), {
            cellWidth: 8,
            cellHeight: 16,
        });
        expect(svg).toContain(
            `<text x="0" y="12" textLength="8" lengthAdjust="spacingAndGlyphs" fill="#0a141e">A</text>`,
        );
    });

    it("merges contiguous cells with identical fg and style into one run", () => {
        const fg = packRgb(200, 200, 200);
        const svg = gridToSvg(snapshot([[cell({ char: "h", fg }), cell({ char: "i", fg })]]), { cellWidth: 8 });
        expect(svg).toContain(`textLength="16"`);
        expect(svg).toContain(`>hi</text>`);
    });

    it("breaks a run on fg change, style change and gaps", () => {
        const fgA = packRgb(1, 1, 1);
        const fgB = packRgb(2, 2, 2);
        // "a" fgA, "b" fgB (fg change), space (gap), "c" fgA bold (style change vs a)
        const svg = gridToSvg(
            snapshot([
                [
                    cell({ char: "a", fg: fgA }),
                    cell({ char: "b", fg: fgB }),
                    cell({ char: " " }),
                    cell({ char: "c", fg: fgA, style: StyleFlags.Bold }),
                ],
            ]),
            { cellWidth: 8 },
        );
        expect(svg).toContain(`>a</text>`);
        expect(svg).toContain(`>b</text>`);
        expect(svg).toContain(`>c</text>`);
        // "c" starts at column 3 → x=24
        expect(svg).toContain(`x="24"`);
    });

    it("does not emit text for blank space cells", () => {
        const svg = gridToSvg(snapshot([[cell({ char: " " }), cell({ char: " " })]]));
        expect(svg).not.toContain("<text");
    });

    it("draws background rects only for non-default backgrounds, merged per row", () => {
        const bg = packRgb(50, 60, 70);
        const svg = gridToSvg(snapshot([[cell({ bg }), cell({ bg }), cell({ bg: DEFAULT_COLOR })]]), {
            cellWidth: 8,
            cellHeight: 16,
        });
        // Two adjacent bg cells merge into one rect of width 16; the default one is skipped.
        expect(svg).toContain(`<rect x="0" y="0" width="16" height="16" fill="#323c46"/>`);
        // Only the page rect + one bg rect.
        expect(svg.match(/<rect/gu)).toHaveLength(2);
    });

    it("applies Inverse by swapping fg and bg", () => {
        const fg = packRgb(0xff, 0x00, 0x00);
        const bg = packRgb(0x00, 0xff, 0x00);
        const svg = gridToSvg(snapshot([[cell({ char: "X", fg, bg, style: StyleFlags.Inverse })]]), {
            cellWidth: 8,
            cellHeight: 16,
        });
        // Background painted with the original fg; glyph painted with the original bg.
        expect(svg).toContain(`height="16" fill="#ff0000"/>`);
        expect(svg).toContain(`fill="#00ff00">X</text>`);
    });

    it("spans wide characters over two columns and skips the continuation cell", () => {
        const svg = gridToSvg(
            snapshot([[cell({ char: "中", width: 2, fg: packRgb(1, 2, 3) }), cell({ char: "", width: 0 })]]),
            { cellWidth: 8 },
        );
        expect(svg).toContain(`textLength="16"`); // two columns wide
        expect(svg).toContain(`>中</text>`);
    });

    it("encodes each text style", () => {
        const fg = packRgb(9, 9, 9);
        const styled = (style: number): string => gridToSvg(snapshot([[cell({ char: "z", fg, style })]]));
        expect(styled(StyleFlags.Bold)).toContain(`font-weight="bold"`);
        expect(styled(StyleFlags.Italic)).toContain(`font-style="italic"`);
        expect(styled(StyleFlags.Underline)).toContain(`text-decoration="underline"`);
        expect(styled(StyleFlags.Undercurl)).toContain(`text-decoration="underline"`);
        expect(styled(StyleFlags.Strikethrough)).toContain(`text-decoration="line-through"`);
        expect(styled(StyleFlags.Underline | StyleFlags.Strikethrough)).toContain(
            `text-decoration="underline line-through"`,
        );
        expect(styled(StyleFlags.Dim)).toContain(`opacity="0.6"`);
        expect(styled(StyleFlags.None)).not.toContain("font-weight");
    });

    it("escapes XML metacharacters in glyphs", () => {
        const fg = packRgb(1, 1, 1);
        const svg = gridToSvg(snapshot([[cell({ char: "<", fg }), cell({ char: "&", fg }), cell({ char: ">", fg })]]));
        expect(svg).toContain(`&lt;&amp;&gt;`);
    });

    it("escapes XML in the font family name", () => {
        const svg = gridToSvg(snapshot([[cell({})]]), { fontFamily: `A & B` });
        expect(svg).toContain(`font-family="A &amp; B"`);
    });

    it("treats a stray width-0 cell as a one-column blank", () => {
        const svg = gridToSvg(snapshot([[cell({ char: "", width: 0 }), cell({ char: "q", fg: packRgb(1, 1, 1) })]]), {
            cellWidth: 8,
        });
        // "q" is at column 1 → x=8, not merged with the stray cell.
        expect(svg).toContain(`x="8"`);
        expect(svg).toContain(`>q</text>`);
    });
});
