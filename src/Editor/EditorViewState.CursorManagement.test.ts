import { describe, it, expect } from "vitest";
import { TextDocument } from "./TextDocument.ts";
import { EditorViewState } from "./EditorViewState.ts";
import { createCursorSelection, createSelection } from "./ISelection.ts";
import { createFoldingRegion } from "./IFoldingRegion.ts";
import { parseDSL, renderToDSL, editorState, expectEditorState } from "./EditorTestUtils/TrackDSL.ts";

// ─── Folding: Basic Mapping ────────────────────────────────

describe("EditorViewState.Folding — basic mapping", () => {
    it("getViewLineCount equals document lineCount when no folds", () => {
        const state = parseDSL(editorState`
            text: line 0
            text: line 1
            text: line 2
            cursor: █
        `);
        expect(state.getViewLineCount()).toBe(3);
    });

    it("getViewLineCount accounts for a single collapsed region", () => {
        const state = parseDSL(editorState`
            text: function foo() {
            folding: >
            text:   console.log(1);
            folding: |
            text:   console.log(2);
            folding: |
            text: }
            folding: ^
            cursor: █
        `);
        // Lines 1,2 are hidden (startLine+1..endLine = 1..3), but startLine(0) and endLine(3) — wait:
        // startLine=0, endLine=3, collapsed. Hidden = lines 1,2,3. Visible = line 0 only? No:
        // Hidden = startLine+1 .. endLine = 1..3. So lines 0 is visible. Lines 1,2,3 hidden.
        // Total doc lines = 4, hidden = 3, visible = 1
        expect(state.getViewLineCount()).toBe(1);
    });

    it("getViewLine skips collapsed lines", () => {
        const state = parseDSL(editorState`
            text: header
            folding: >
            text:   body1
            folding: |
            text:   body2
            folding: ^
            text: footer
            cursor: █
        `);
        // 4 doc lines. Collapsed region startLine=0, endLine=2. Hidden = 1,2. Visible = [0, 3]
        expect(state.getViewLineCount()).toBe(2);
        expect(state.getViewLine(0)).toBe("header");
        expect(state.getViewLine(1)).toBe("footer");
    });

    it("getViewLine works with multiple collapsed regions", () => {
        const state = parseDSL(editorState`
            text: a
            folding: >
            text: b
            folding: ^
            text: c
            folding: >
            text: d
            folding: ^
            text: e
            cursor: █
        `);
        // Regions: (0,1 collapsed), (2,3 collapsed)
        // Hidden: 1, 3. Visible: [0, 2, 4]
        expect(state.getViewLineCount()).toBe(3);
        expect(state.getViewLine(0)).toBe("a");
        expect(state.getViewLine(1)).toBe("c");
        expect(state.getViewLine(2)).toBe("e");
    });

    it("all expanded means viewLineCount equals document lineCount", () => {
        const state = parseDSL(editorState`
            text: a
            folding: v
            text: b
            folding: |
            text: c
            folding: ^
            cursor: █
        `);
        expect(state.getViewLineCount()).toBe(3);
        expect(state.getViewLine(0)).toBe("a");
        expect(state.getViewLine(1)).toBe("b");
        expect(state.getViewLine(2)).toBe("c");
    });

    it("logicalToVisualLine returns -1 for hidden lines", () => {
        const state = parseDSL(editorState`
            text: a
            folding: >
            text: b
            folding: |
            text: c
            folding: ^
            text: d
            cursor: █
        `);
        expect(state.logicalToVisualLine(0)).toBe(0);
        expect(state.logicalToVisualLine(1)).toBe(-1);
        expect(state.logicalToVisualLine(2)).toBe(-1);
        expect(state.logicalToVisualLine(3)).toBe(1);
    });

    it("visualToLogicalLine maps correctly", () => {
        const state = parseDSL(editorState`
            text: a
            folding: >
            text: b
            folding: |
            text: c
            folding: ^
            text: d
            cursor: █
        `);
        expect(state.visualToLogicalLine(0)).toBe(0);
        expect(state.visualToLogicalLine(1)).toBe(3);
        expect(state.visualToLogicalLine(2)).toBe(-1); // out of range
    });
});

// ─── Folding: Cursor Navigation ────────────────────────────

describe("EditorViewState.Folding — cursor navigation", () => {
    it("moveCursorDown skips collapsed region", () => {
        const state = parseDSL(editorState`
            text: header
            folding: >
            cursor: █
            text:   body1
            folding: |
            text:   body2
            folding: ^
            text: footer
        `);
        state.moveCursorDown();
        expectEditorState(state, editorState`
            text: header
            folding: >
            text:   body1
            folding: |
            text:   body2
            folding: ^
            text: footer
            cursor: █
        `);
    });

    it("moveCursorUp skips collapsed region", () => {
        const state = parseDSL(editorState`
            text: header
            folding: >
            text:   body1
            folding: |
            text:   body2
            folding: ^
            text: footer
            cursor: █
        `);
        state.moveCursorUp();
        expectEditorState(state, editorState`
            text: header
            cursor: █
            folding: >
            text:   body1
            folding: |
            text:   body2
            folding: ^
            text: footer
        `);
    });

    it("moveCursorDown does nothing at last visible line", () => {
        const state = parseDSL(editorState`
            text: a
            folding: >
            text: b
            folding: ^
            text: c
            cursor: █
        `);
        // cursor at line 2, which is the last visible line
        state.moveCursorDown();
        expect(state.selections[0].active.line).toBe(2);
    });

    it("moveCursorUp does nothing at first line", () => {
        const state = parseDSL(editorState`
            text: a
            folding: >
            cursor: █
            text: b
            folding: ^
            text: c
        `);
        state.moveCursorUp();
        expect(state.selections[0].active.line).toBe(0);
    });

    it("moveCursorRight wraps to next visible line, skipping collapsed", () => {
        const state = parseDSL(editorState`
            text: ab
            folding: >
            cursor:   █
            text: cd
            folding: ^
            text: ef
        `);
        // cursor at line 0, char 2 (end of line)
        state.moveCursorRight();
        // Should wrap to line 2 (next visible), char 0
        expect(state.selections[0].active.line).toBe(2);
        expect(state.selections[0].active.character).toBe(0);
    });

    it("moveCursorLeft wraps to previous visible line, skipping collapsed", () => {
        const state = parseDSL(editorState`
            text: ab
            folding: >
            text: cd
            folding: ^
            text: ef
            cursor: █
        `);
        // cursor at line 2, char 0
        state.moveCursorLeft();
        // Should wrap to line 0 (previous visible), char 2 (end of "ab")
        expect(state.selections[0].active.line).toBe(0);
        expect(state.selections[0].active.character).toBe(2);
    });

    it("moveCursorDown clamps character to target line length", () => {
        const state = parseDSL(editorState`
            text: longline
            folding: >
            cursor:      █
            text: hid
            folding: ^
            text: xy
        `);
        // cursor at line 0, char 5. Target (line 2) has length 2
        state.moveCursorDown();
        expect(state.selections[0].active.line).toBe(2);
        expect(state.selections[0].active.character).toBe(2);
    });
});

// ─── Folding: Auto-expand ──────────────────────────────────

describe("EditorViewState.Folding — auto-expand", () => {
    it("ensureLineVisible expands collapsed region containing the line", () => {
        const state = parseDSL(editorState`
            text: a
            folding: >
            text: b
            folding: |
            text: c
            folding: ^
            cursor: █
        `);
        expect(state.foldedRegions[0].isCollapsed).toBe(true);
        state.ensureLineVisible(1);
        expect(state.foldedRegions[0].isCollapsed).toBe(false);
    });

    it("ensureLineVisible is no-op for visible lines", () => {
        const state = parseDSL(editorState`
            text: a
            folding: >
            text: b
            folding: ^
            text: c
            cursor: █
        `);
        state.ensureLineVisible(0); // startLine — always visible
        expect(state.foldedRegions[0].isCollapsed).toBe(true);
        state.ensureLineVisible(2); // outside region
        expect(state.foldedRegions[0].isCollapsed).toBe(true);
    });

    it("ensureLineVisible does not expand region if line is the startLine", () => {
        const state = parseDSL(editorState`
            text: a
            folding: >
            text: b
            folding: ^
            cursor: █
        `);
        state.ensureLineVisible(0);
        expect(state.foldedRegions[0].isCollapsed).toBe(true);
    });
});

// ─── Folding: Toggle & Fold/Unfold All ─────────────────────

describe("EditorViewState.Folding — toggle and foldAll/unfoldAll", () => {
    it("toggleFold collapses an expanded region", () => {
        const state = parseDSL(editorState`
            text: a
            folding: v
            text: b
            folding: ^
            cursor: █
        `);
        expect(state.foldedRegions[0].isCollapsed).toBe(false);
        state.toggleFold(0);
        expect(state.foldedRegions[0].isCollapsed).toBe(true);
    });

    it("toggleFold expands a collapsed region", () => {
        const state = parseDSL(editorState`
            text: a
            folding: >
            text: b
            folding: ^
            cursor: █
        `);
        expect(state.foldedRegions[0].isCollapsed).toBe(true);
        state.toggleFold(0);
        expect(state.foldedRegions[0].isCollapsed).toBe(false);
    });

    it("toggleFold is no-op if no region at line", () => {
        const state = parseDSL(editorState`
            text: a
            folding: v
            text: b
            folding: ^
            cursor: █
        `);
        state.toggleFold(1); // no region starts at line 1
        expect(state.foldedRegions[0].isCollapsed).toBe(false);
    });

    it("foldAll collapses all regions", () => {
        const state = parseDSL(editorState`
            text: a
            folding: v
            text: b
            folding: ^
            text: c
            folding: v
            text: d
            folding: ^
            cursor: █
        `);
        state.foldAll();
        expect(state.foldedRegions.every((r) => r.isCollapsed)).toBe(true);
    });

    it("unfoldAll expands all regions", () => {
        const state = parseDSL(editorState`
            text: a
            folding: >
            text: b
            folding: ^
            text: c
            folding: >
            text: d
            folding: ^
            cursor: █
        `);
        state.unfoldAll();
        expect(state.foldedRegions.every((r) => !r.isCollapsed)).toBe(true);
    });
});

// ─── Folding: Edit Tracking ────────────────────────────────

describe("EditorViewState.Folding — edit tracking", () => {
    it("inserting lines above a region shifts its boundaries", () => {
        const doc = new TextDocument("a\nb\nc\nd");
        const state = new EditorViewState(doc, [createCursorSelection(0, 1)]);
        state.setFoldingRegions([createFoldingRegion(2, 3, false)]);

        // Type newline at end of line 0 → inserts a line, pushing everything down
        state.type("\n");

        expect(state.foldedRegions[0].startLine).toBe(3);
        expect(state.foldedRegions[0].endLine).toBe(4);
    });

    it("inserting lines inside an expanded region shifts endLine", () => {
        const doc = new TextDocument("a\nb\nc");
        const state = new EditorViewState(doc, [createCursorSelection(1, 1)]);
        state.setFoldingRegions([createFoldingRegion(0, 2, false)]);

        // Type newline inside the region (at line 1)
        state.type("\n");

        expect(state.foldedRegions[0].startLine).toBe(0);
        expect(state.foldedRegions[0].endLine).toBe(3);
    });

    it("deleting lines above a region shifts its boundaries down", () => {
        const doc = new TextDocument("x\na\nb\nc");
        const state = new EditorViewState(doc, [createCursorSelection(1, 0)]);
        state.setFoldingRegions([createFoldingRegion(2, 3, false)]);

        // Delete left at beginning of line 1 → merges line 1 into line 0
        state.deleteLeft();

        expect(state.foldedRegions[0].startLine).toBe(1);
        expect(state.foldedRegions[0].endLine).toBe(2);
    });

    it("edit crossing region boundary removes the region", () => {
        const doc = new TextDocument("a\nb\nc\nd");
        const state = new EditorViewState(doc, [createCursorSelection(1, 0)]);
        state.setFoldingRegions([createFoldingRegion(0, 1, false)]);

        // Select from line 0 char 0 to line 1 char 0 and type "x" — crosses region start
        // Actually let's use the existing API: position cursor at start of line 1 and deleteLeft
        // That merges line 0 and line 1 → edit range (0, lineLen(0)) to (1, 0)
        state.deleteLeft();

        // Region should be removed because edit crossed startLine boundary
        expect(state.foldedRegions.length).toBe(0);
    });
});

// ─── Construction ───────────────────────────────────────────

describe("EditorViewState.CursorManagement", () => {
    it("placeholder", () => {
        // Future cursor management tests
    });
});
