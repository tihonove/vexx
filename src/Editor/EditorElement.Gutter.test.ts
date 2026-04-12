import { describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { EditorElement } from "./EditorElement.ts";
import { EditorViewState } from "./EditorViewState.ts";
import { TextDocument } from "./TextDocument.ts";

function createEditor(text: string, width = 30, height = 10): { app: TestApp; editor: EditorElement } {
    const doc = new TextDocument(text);
    const viewState = new EditorViewState(doc);
    const editor = new EditorElement(viewState);
    const app = TestApp.createWithContent(editor, new Size(width, height));
    return { app, editor };
}

// ─── gutterWidth ────────────────────────────────────────────

describe("gutterWidth", () => {
    it("returns GUTTER_LEFT_PADDING + 1 digit + 1 separator for 1–9 lines", () => {
        const { editor } = createEditor("a\nb\nc");
        // 3 lines → 1 digit → 2 + 1 + 1 = 4
        expect(editor.gutterWidth).toBe(4);
    });

    it("returns GUTTER_LEFT_PADDING + 2 digits + 1 separator for 10–99 lines", () => {
        const lines = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join("\n");
        const { editor } = createEditor(lines);
        // 15 lines → 2 digits → 2 + 2 + 1 = 5
        expect(editor.gutterWidth).toBe(5);
    });

    it("returns GUTTER_LEFT_PADDING + 3 digits + 1 separator for 100–999 lines", () => {
        const lines = Array.from({ length: 100 }, (_, i) => `${i}`).join("\n");
        const { editor } = createEditor(lines);
        // 100 lines → 3 digits → 2 + 3 + 1 = 6
        expect(editor.gutterWidth).toBe(6);
    });

    it("returns at least 1 digit for a single-line document", () => {
        const { editor } = createEditor("hello");
        // 1 line → 1 digit → 2 + 1 + 1 = 4
        expect(editor.gutterWidth).toBe(4);
    });
});

// ─── Gutter rendering ───────────────────────────────────────

describe("gutter rendering", () => {
    it("renders line numbers right-aligned with left padding", () => {
        const { app } = createEditor("AAA\nBBB\nCCC", 15, 5);
        app.render();

        const backend = app.backend;
        // gutterWidth = 4 (2 pad + 1 digit + 1 sep)
        // Row 0: "  1 AAA        "
        // Row 1: "  2 BBB        "
        // Row 2: "  3 CCC        "
        expect(backend.getTextAt(new Point(0, 0), 4)).toBe("  1 ");
        expect(backend.getTextAt(new Point(0, 1), 4)).toBe("  2 ");
        expect(backend.getTextAt(new Point(0, 2), 4)).toBe("  3 ");
    });

    it("pads line numbers for multi-digit counts", () => {
        const lines = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + (i % 26))).join("\n");
        const { app } = createEditor(lines, 20, 12);
        app.render();

        const backend = app.backend;
        // gutterWidth = 5 (2 pad + 2 digits + 1 sep)
        expect(backend.getTextAt(new Point(0, 0), 5)).toBe("   1 ");
        expect(backend.getTextAt(new Point(0, 8), 5)).toBe("   9 ");
        expect(backend.getTextAt(new Point(0, 9), 5)).toBe("  10 ");
        expect(backend.getTextAt(new Point(0, 11), 5)).toBe("  12 ");
    });

    it("renders tildes past end of document with empty gutter", () => {
        const { app } = createEditor("One\nTwo", 15, 5);
        app.render();

        const backend = app.backend;
        // Lines 0,1 have content; lines 2,3,4 should have empty gutter + tilde
        // gutterWidth = 4
        expect(backend.getTextAt(new Point(0, 2), 5)).toBe("    ~");
        expect(backend.getTextAt(new Point(0, 3), 5)).toBe("    ~");
        expect(backend.getTextAt(new Point(0, 4), 5)).toBe("    ~");
    });

    it("renders content shifted right by gutterWidth", () => {
        const { app } = createEditor("Hello", 20, 3);
        app.render();

        const backend = app.backend;
        // gutterWidth = 4
        expect(backend.getTextAt(new Point(4, 0), 5)).toBe("Hello");
    });

    it("full screen rendering matches expected layout", () => {
        const { app } = createEditor("AB\nCD\nEF", 10, 5);
        app.render();

        const backend = app.backend;
        // gutterWidth = 4
        expect(backend.getTextAt(new Point(0, 0), 10)).toBe("  1 AB    ");
        expect(backend.getTextAt(new Point(0, 1), 10)).toBe("  2 CD    ");
        expect(backend.getTextAt(new Point(0, 2), 10)).toBe("  3 EF    ");
        expect(backend.getTextAt(new Point(0, 3), 10)).toBe("    ~     ");
        expect(backend.getTextAt(new Point(0, 4), 10)).toBe("    ~     ");
    });
});

// ─── Gutter colors ──────────────────────────────────────────

describe("gutter colors", () => {
    it("uses lineNumberForeground for non-active lines", () => {
        const lnFg = packRgb(100, 100, 100);
        const { app, editor } = createEditor("AAA\nBBB\nCCC", 15, 5);
        editor.lineNumberForeground = lnFg;
        app.render();

        const backend = app.backend;
        // Line 1 (row 0) is active (cursor is at line 0), so check line 2 (row 1)
        // Digit "2" is at column 2 (after 2-char padding)
        expect(backend.getFgAt(new Point(2, 1))).toBe(lnFg);
    });

    it("uses lineNumberActiveForeground for the cursor line", () => {
        const lnActiveFg = packRgb(200, 200, 200);
        const { app, editor } = createEditor("AAA\nBBB\nCCC", 15, 5);
        editor.lineNumberActiveForeground = lnActiveFg;
        app.render();

        const backend = app.backend;
        // Cursor is at line 0 → row 0 is active → digit "1" at column 2
        expect(backend.getFgAt(new Point(2, 0))).toBe(lnActiveFg);
    });

    it("uses gutterBackground for gutter area", () => {
        const gutBg = packRgb(20, 20, 20);
        const { app, editor } = createEditor("AAA\nBBB", 15, 4);
        editor.gutterBackground = gutBg;
        app.render();

        const backend = app.backend;
        // All gutter columns (0..3) should have gutBg
        for (let x = 0; x < 4; x++) {
            expect(backend.getBgAt(new Point(x, 0))).toBe(gutBg);
            expect(backend.getBgAt(new Point(x, 1))).toBe(gutBg);
        }
    });

    it("uses editor resolved style bg for content area", () => {
        const editorBg = packRgb(30, 30, 30);
        const { app, editor } = createEditor("Hi", 15, 3);
        editor.style = { bg: editorBg };
        app.render();

        const backend = app.backend;
        // Content starts at gutterWidth = 4
        expect(backend.getBgAt(new Point(4, 0))).toBe(editorBg);
        expect(backend.getBgAt(new Point(5, 0))).toBe(editorBg);
    });

    it("uses editor resolved style fg for text", () => {
        const editorFg = packRgb(212, 212, 212);
        const { app, editor } = createEditor("Hi", 15, 3);
        editor.style = { fg: editorFg };
        app.render();

        const backend = app.backend;
        // "H" at column 4 (gutterWidth)
        expect(backend.getFgAt(new Point(4, 0))).toBe(editorFg);
    });

    it("defaults gutter bg to editor bg when gutterBackground is not set", () => {
        const editorBg = packRgb(40, 40, 40);
        const { app, editor } = createEditor("Hi", 15, 3);
        editor.style = { bg: editorBg };
        app.render();

        const backend = app.backend;
        // Gutter columns should inherit editor background
        expect(backend.getBgAt(new Point(0, 0))).toBe(editorBg);
        expect(backend.getBgAt(new Point(2, 0))).toBe(editorBg);
    });

    it("uses default line number colors when not explicitly set", () => {
        const { app } = createEditor("AAA\nBBB", 15, 4);
        app.render();

        const backend = app.backend;
        const defaultLnFg = packRgb(133, 133, 133);
        const defaultLnActiveFg = packRgb(198, 198, 198);

        // Row 0 is active (cursor at line 0) → active color
        expect(backend.getFgAt(new Point(2, 0))).toBe(defaultLnActiveFg);
        // Row 1 is not active → default line number color
        expect(backend.getFgAt(new Point(2, 1))).toBe(defaultLnFg);
    });
});

// ─── Content area ───────────────────────────────────────────

describe("content area rendering", () => {
    it("renders text content after gutter", () => {
        const { app } = createEditor("Hello World", 20, 3);
        app.render();

        const backend = app.backend;
        // gutterWidth = 4, content starts at 4
        expect(backend.getTextAt(new Point(4, 0), 11)).toBe("Hello World");
    });

    it("fills remaining space with spaces for short lines", () => {
        const { app } = createEditor("Hi", 12, 2);
        app.render();

        const backend = app.backend;
        // gutterWidth = 4, content area = 8 cols
        // "Hi" takes 2 chars, rest should be spaces
        expect(backend.getTextAt(new Point(4, 0), 8)).toBe("Hi      ");
    });

    it("handles empty document", () => {
        const { app } = createEditor("", 12, 3);
        app.render();

        const backend = app.backend;
        // Line 0: "  1 " gutter + empty content
        expect(backend.getTextAt(new Point(0, 0), 4)).toBe("  1 ");
        // Past end: tildes
        expect(backend.getTextAt(new Point(4, 1), 1)).toBe("~");
    });

    it("correctly shows selection background in content area", () => {
        const selBg = packRgb(38, 79, 120);
        const { app, editor } = createEditor("Hello World", 20, 3);
        // Select "ello" (chars 1-5) by setting selection directly
        editor.viewState.selections = [
            { anchor: { line: 0, character: 1 }, active: { line: 0, character: 5 } },
        ];
        app.render();

        const backend = app.backend;
        // "ello" should have selection bg at columns 4+1..4+4 = 5,6,7,8
        expect(backend.getBgAt(new Point(5, 0))).toBe(selBg);
        expect(backend.getBgAt(new Point(6, 0))).toBe(selBg);
        expect(backend.getBgAt(new Point(7, 0))).toBe(selBg);
        expect(backend.getBgAt(new Point(8, 0))).toBe(selBg);
    });
});

// ─── Scrolling ──────────────────────────────────────────────

describe("scrolling", () => {
    const tenLines = Array.from({ length: 10 }, (_, i) => `Line${i + 1}`).join("\n");

    describe("vertical scroll", () => {
        it("shows correct line numbers after scrolling down", () => {
            // 10 lines, viewport height = 4 → gutterWidth = 5 (2+2+1)
            const { app, editor } = createEditor(tenLines, 20, 4);
            editor.viewState.scrollTop = 3;
            app.render();

            const backend = app.backend;
            // Visible lines: 4,5,6,7 (0-indexed: 3,4,5,6)
            expect(backend.getTextAt(new Point(0, 0), 5)).toBe("   4 ");
            expect(backend.getTextAt(new Point(0, 1), 5)).toBe("   5 ");
            expect(backend.getTextAt(new Point(0, 2), 5)).toBe("   6 ");
            expect(backend.getTextAt(new Point(0, 3), 5)).toBe("   7 ");
        });

        it("shows correct content after scrolling down", () => {
            const { app, editor } = createEditor(tenLines, 20, 4);
            editor.viewState.scrollTop = 3;
            app.render();

            const backend = app.backend;
            // gutterWidth = 5
            expect(backend.getTextAt(new Point(5, 0), 5)).toBe("Line4");
            expect(backend.getTextAt(new Point(5, 1), 5)).toBe("Line5");
        });

        it("shows tildes when scrolled near end of document", () => {
            const { app, editor } = createEditor(tenLines, 20, 4);
            editor.viewState.scrollTop = 8;
            app.render();

            const backend = app.backend;
            // Lines 9,10 are visible + 2 rows past end
            expect(backend.getTextAt(new Point(0, 0), 5)).toBe("   9 ");
            expect(backend.getTextAt(new Point(0, 1), 5)).toBe("  10 ");
            // Past end — empty gutter + tilde
            expect(backend.getTextAt(new Point(0, 2), 6)).toBe("     ~");
            expect(backend.getTextAt(new Point(0, 3), 6)).toBe("     ~");
        });

        it("highlights active line number after scroll", () => {
            const lnFg = packRgb(100, 100, 100);
            const lnActiveFg = packRgb(200, 200, 200);
            const { app, editor } = createEditor(tenLines, 20, 4);
            editor.lineNumberForeground = lnFg;
            editor.lineNumberActiveForeground = lnActiveFg;
            // Cursor on line 5, scroll to show it
            editor.viewState.selections = [
                { anchor: { line: 5, character: 0 }, active: { line: 5, character: 0 } },
            ];
            editor.viewState.scrollTop = 3;
            app.render();

            const backend = app.backend;
            // Line 5 is at screenY=2 (scrollTop=3, line5 is viewLine=5, screenY=5-3=2)
            // Digit column = 2 (GUTTER_LEFT_PADDING)
            expect(backend.getFgAt(new Point(2, 2))).toBe(lnActiveFg);
            // Line 4 at screenY=0 is not active
            expect(backend.getFgAt(new Point(2, 0))).toBe(lnFg);
        });
    });

    describe("horizontal scroll", () => {
        it("shows correct content after horizontal scroll", () => {
            const { app, editor } = createEditor("ABCDEFGHIJKLMNOP", 12, 2);
            // gutterWidth = 4, contentCols = 8
            editor.viewState.scrollLeft = 3;
            app.render();

            const backend = app.backend;
            // Content shifts: scrollLeft=3, so first visible char at docChar=3 → "D"
            expect(backend.getTextAt(new Point(4, 0), 8)).toBe("DEFGHIJK");
        });

        it("gutter is not affected by horizontal scroll", () => {
            const { app, editor } = createEditor("ABCDEFGHIJKLMNOP", 12, 2);
            editor.viewState.scrollLeft = 5;
            app.render();

            const backend = app.backend;
            // Gutter still shows "  1 " regardless of horizontal scroll
            expect(backend.getTextAt(new Point(0, 0), 4)).toBe("  1 ");
        });

        it("fills with spaces when scrolled past line content", () => {
            const { app, editor } = createEditor("Hi", 12, 2);
            // gutterWidth = 4, contentCols = 8
            editor.viewState.scrollLeft = 1;
            app.render();

            const backend = app.backend;
            // "Hi" with scrollLeft=1 → visible char at docChar=1 is "i", then spaces
            expect(backend.getTextAt(new Point(4, 0), 8)).toBe("i       ");
        });
    });

    describe("combined vertical + horizontal scroll", () => {
        it("applies both scroll offsets correctly", () => {
            const lines = Array.from({ length: 10 }, (_, i) => `ABCDEFGH_${i + 1}`).join("\n");
            const { app, editor } = createEditor(lines, 16, 3);
            // gutterWidth = 5 (2+2+1), contentCols = 11
            editor.viewState.scrollTop = 4;
            editor.viewState.scrollLeft = 2;
            app.render();

            const backend = app.backend;
            // Line numbers: 5,6,7
            expect(backend.getTextAt(new Point(0, 0), 5)).toBe("   5 ");
            expect(backend.getTextAt(new Point(0, 1), 5)).toBe("   6 ");
            // Content of line 5 ("ABCDEFGH_5") scrollLeft=2 → "CDEFGH_5"
            expect(backend.getTextAt(new Point(5, 0), 8)).toBe("CDEFGH_5");
        });
    });
});
