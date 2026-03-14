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
    it("cursorDown skips collapsed region", () => {
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
        state.cursorDown();
        expectEditorState(
            state,
            editorState`
            text: header
            folding: >
            text:   body1
            folding: |
            text:   body2
            folding: ^
            text: footer
            cursor: █
        `,
        );
    });

    it("cursorUp skips collapsed region", () => {
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
        state.cursorUp();
        expectEditorState(
            state,
            editorState`
            text: header
            cursor: █
            folding: >
            text:   body1
            folding: |
            text:   body2
            folding: ^
            text: footer
        `,
        );
    });

    it("cursorDown does nothing at last visible line", () => {
        const state = parseDSL(editorState`
            text: a
            folding: >
            text: b
            folding: ^
            text: c
            cursor: █
        `);
        // cursor at line 2, which is the last visible line
        state.cursorDown();
        expect(state.selections[0].active.line).toBe(2);
    });

    it("cursorUp does nothing at first line", () => {
        const state = parseDSL(editorState`
            text: a
            folding: >
            cursor: █
            text: b
            folding: ^
            text: c
        `);
        state.cursorUp();
        expect(state.selections[0].active.line).toBe(0);
    });

    it("cursorRight wraps to next visible line, skipping collapsed", () => {
        const state = parseDSL(editorState`
            text: ab
            folding: >
            cursor:   █
            text: cd
            folding: ^
            text: ef
        `);
        // cursor at line 0, char 2 (end of line)
        state.cursorRight();
        // Should wrap to line 2 (next visible), char 0
        expect(state.selections[0].active.line).toBe(2);
        expect(state.selections[0].active.character).toBe(0);
    });

    it("cursorLeft wraps to previous visible line, skipping collapsed", () => {
        const state = parseDSL(editorState`
            text: ab
            folding: >
            text: cd
            folding: ^
            text: ef
            cursor: █
        `);
        // cursor at line 2, char 0
        state.cursorLeft();
        // Should wrap to line 0 (previous visible), char 2 (end of "ab")
        expect(state.selections[0].active.line).toBe(0);
        expect(state.selections[0].active.character).toBe(2);
    });

    it("cursorDown clamps character to target line length", () => {
        const state = parseDSL(editorState`
            text: longline
            folding: >
            cursor:      █
            text: hid
            folding: ^
            text: xy
        `);
        // cursor at line 0, char 5. Target (line 2) has length 2
        state.cursorDown();
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
    // ─── idealColumn: vertical navigation preserves column memory ────

    it("cursorDown through short line preserves idealColumn", () => {
        // Lines: "abcdef" (6), "hi" (2), "xyzwv" (5)
        const doc = new TextDocument("abcdef\nhi\nxyzwv");
        const state = new EditorViewState(doc, [createCursorSelection(0, 5)]);
        // idealColumn defaults to 5
        state.cursorDown(); // line 1 len=2 → char=2, idealColumn still 5
        expect(state.selections[0].active).toEqual({ line: 1, character: 2 });
        state.cursorDown(); // line 2 len=5 → char=5, idealColumn still 5
        expect(state.selections[0].active).toEqual({ line: 2, character: 5 });
    });

    it("cursorUp through short line preserves idealColumn", () => {
        const doc = new TextDocument("xyzwv\nhi\nabcdef");
        const state = new EditorViewState(doc, [createCursorSelection(2, 5)]);
        state.cursorUp(); // line 1 len=2 → char=2, idealColumn still 5
        expect(state.selections[0].active).toEqual({ line: 1, character: 2 });
        state.cursorUp(); // line 0 len=5 → char=5, idealColumn still 5
        expect(state.selections[0].active).toEqual({ line: 0, character: 5 });
    });

    // ─── cursorEnd sets ideal to MAX_SAFE_INTEGER ("sticky right edge") ────

    it("cursorEnd then cursorDown sticks to right edge", () => {
        const doc = new TextDocument("short\nlonger line\nhi");
        const state = new EditorViewState(doc, [createCursorSelection(0, 0)]);
        state.cursorEnd();
        expect(state.selections[0].active).toEqual({ line: 0, character: 5 });

        state.cursorDown(); // "longer line" len=11 → char=11
        expect(state.selections[0].active).toEqual({ line: 1, character: 11 });

        state.cursorDown(); // "hi" len=2 → char=2
        expect(state.selections[0].active).toEqual({ line: 2, character: 2 });
    });

    // ─── cursorHome sets ideal to 0 ────

    it("cursorHome sets activeColumn and idealColumn to 0", () => {
        const doc = new TextDocument("hello\nworld");
        const state = new EditorViewState(doc, [createCursorSelection(0, 3)]);
        state.cursorHome();
        expect(state.selections[0].active).toEqual({ line: 0, character: 0 });

        state.cursorDown(); // idealColumn=0, so char stays 0
        expect(state.selections[0].active).toEqual({ line: 1, character: 0 });
    });

    // ─── cursorLeft / cursorRight reset idealColumn ────

    it("cursorLeft resets idealColumn", () => {
        const doc = new TextDocument("abcdef\nhi\nabcdef");
        const state = new EditorViewState(doc, [createCursorSelection(0, 5)]);
        state.cursorDown(); // now at (1, 2), idealColumn=5
        state.cursorLeft(); // now at (1, 1), idealColumn=1
        state.cursorDown(); // idealColumn=1 → (2, 1)
        expect(state.selections[0].active).toEqual({ line: 2, character: 1 });
    });

    it("cursorRight resets idealColumn", () => {
        const doc = new TextDocument("abcdef\nhi\nabcdef");
        const state = new EditorViewState(doc, [createCursorSelection(0, 5)]);
        state.cursorDown(); // now at (1, 2), idealColumn=5
        state.cursorRight(); // wraps to (2, 0), idealColumn=0
        state.cursorDown(); // no more lines, stays at (2, 0)
        expect(state.selections[0].active).toEqual({ line: 2, character: 0 });
    });

    // ─── Selection mode: cursorRight(true) creates selection ────

    it("cursorRight with inSelectionMode creates selection", () => {
        const doc = new TextDocument("hello");
        const state = new EditorViewState(doc, [createCursorSelection(0, 2)]);
        state.cursorRight(true);
        expect(state.selections[0].active).toEqual({ line: 0, character: 3 });
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 2 });
    });

    it("cursorLeft with inSelectionMode creates selection", () => {
        const doc = new TextDocument("hello");
        const state = new EditorViewState(doc, [createCursorSelection(0, 3)]);
        state.cursorLeft(true);
        expect(state.selections[0].active).toEqual({ line: 0, character: 2 });
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 3 });
    });

    it("cursorDown with inSelectionMode extends selection downward", () => {
        const doc = new TextDocument("hello\nworld");
        const state = new EditorViewState(doc, [createCursorSelection(0, 2)]);
        state.cursorDown(true);
        expect(state.selections[0].active).toEqual({ line: 1, character: 2 });
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 2 });
    });

    it("cursorUp with inSelectionMode extends selection upward", () => {
        const doc = new TextDocument("hello\nworld");
        const state = new EditorViewState(doc, [createCursorSelection(1, 3)]);
        state.cursorUp(true);
        expect(state.selections[0].active).toEqual({ line: 0, character: 3 });
        expect(state.selections[0].anchor).toEqual({ line: 1, character: 3 });
    });

    // ─── Selection mode: collapse when inSelectionMode=false ────

    it("cursorRight without selection mode collapses existing selection", () => {
        const doc = new TextDocument("hello");
        const state = new EditorViewState(doc, [createSelection(0, 1, 0, 4)]);
        state.cursorRight(); // active was 4, now 5; anchor collapses to 5
        expect(state.selections[0].active).toEqual({ line: 0, character: 5 });
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 5 });
    });

    // ─── cursorHome / cursorEnd with selection mode ────

    it("cursorEnd with inSelectionMode selects to end of line", () => {
        const doc = new TextDocument("hello world");
        const state = new EditorViewState(doc, [createCursorSelection(0, 3)]);
        state.cursorEnd(true);
        expect(state.selections[0].active).toEqual({ line: 0, character: 11 });
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 3 });
    });

    it("cursorHome with inSelectionMode selects to start of line", () => {
        const doc = new TextDocument("hello world");
        const state = new EditorViewState(doc, [createCursorSelection(0, 5)]);
        state.cursorHome(true);
        expect(state.selections[0].active).toEqual({ line: 0, character: 0 });
        expect(state.selections[0].anchor).toEqual({ line: 0, character: 5 });
    });

    // ─── normalizeSelections sorts multi-cursors ────

    it("normalizeSelections sorts cursors by document order", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        // Provide cursors in reverse order
        const state = new EditorViewState(doc, [createCursorSelection(2, 0), createCursorSelection(0, 0)]);
        state.cursorRight(); // triggers normalizeSelections
        // After sort, line 0 cursor should be first
        expect(state.selections[0].active.line).toBe(0);
        expect(state.selections[1].active.line).toBe(2);
    });
});
