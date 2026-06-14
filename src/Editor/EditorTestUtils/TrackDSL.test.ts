import { describe, expect, it } from "vitest";

import { EditorViewState } from "../EditorViewState.ts";
import { createLineTokens, createToken } from "../ILineTokens.ts";
import { createCursorSelection, createSelection } from "../ISelection.ts";
import { TextDocument } from "../TextDocument.ts";

import { editorState, expectEditorState, parseDSL, renderToDSL } from "./TrackDSL.ts";

// ─── Roundtrip ──────────────────────────────────────────────

describe("TrackDSL", () => {
    it("roundtrips simple text without cursor", () => {
        const dsl = editorState`
            text: hello world
        `;
        const state = parseDSL(dsl);
        expect(state.document.getText()).toBe("hello world");
    });

    it("roundtrips text with a cursor", () => {
        const dsl = editorState`
            text: hello
            cursor:     █
        `;
        const state = parseDSL(dsl);
        expect(state.document.getText()).toBe("hello");
        expect(state.selections).toHaveLength(1);
        expect(state.selections[0].active).toEqual({ line: 0, character: 4 });

        const rendered = renderToDSL(state);
        expect(rendered).toBe(dsl);
    });

    it("roundtrips multi-line text with cursor", () => {
        const dsl = editorState`
            text: hello
            text: world
            cursor: █
        `;
        const state = parseDSL(dsl);
        expect(state.document.lineCount).toBe(2);
        expect(state.document.getLineContent(0)).toBe("hello");
        expect(state.document.getLineContent(1)).toBe("world");
        expect(state.selections[0].active).toEqual({ line: 1, character: 0 });

        const rendered = renderToDSL(state);
        expect(rendered).toBe(dsl);
    });

    it("roundtrips cursor at end of line", () => {
        const dsl = editorState`
            text: hello
            cursor:      █
        `;
        const state = parseDSL(dsl);
        expect(state.selections[0].active).toEqual({ line: 0, character: 5 });

        const rendered = renderToDSL(state);
        expect(rendered).toBe(dsl);
    });

    // ─── Multiple Cursors ───────────────────────────────────

    it("parses multiple cursors on different lines", () => {
        const dsl = editorState`
            text: aaa
            cursor: █
            text: bbb
            cursor: █
        `;
        const state = parseDSL(dsl);
        expect(state.selections).toHaveLength(2);
        expect(state.selections[0].active).toEqual({ line: 0, character: 0 });
        expect(state.selections[1].active).toEqual({ line: 1, character: 0 });

        const rendered = renderToDSL(state);
        expect(rendered).toBe(dsl);
    });

    // ─── Selections ─────────────────────────────────────────

    it("parses a forward selection on one line", () => {
        const dsl = editorState`
            text: hello world
            cursor:            █
            select:       ░░░░░
        `;
        const state = parseDSL(dsl);
        expect(state.selections).toHaveLength(1);
        const sel = state.selections[0];
        // Forward: anchor at start, active at end (cursor)
        expect(sel.anchor).toEqual({ line: 0, character: 6 });
        expect(sel.active).toEqual({ line: 0, character: 11 });
    });

    it("parses a backward selection on one line", () => {
        const dsl = editorState`
            text: hello world
            cursor: █
            select: ░░░░░
        `;
        const state = parseDSL(dsl);
        expect(state.selections).toHaveLength(1);
        const sel = state.selections[0];
        // Backward: anchor at end of selection, active at cursor (start)
        expect(sel.anchor).toEqual({ line: 0, character: 5 });
        expect(sel.active).toEqual({ line: 0, character: 0 });
    });

    // ─── Tokens ─────────────────────────────────────────────

    it("parses and renders token tracks", () => {
        const dsl = editorState`
            text: let x = 5
            cursor: █
            tokens: kkkbbbbnn
        `;
        const state = parseDSL(dsl);
        const tokens = state.tokenStore?.getLineTokens(0);
        expect(tokens).toBeDefined();
        expect(tokens?.tokens).toEqual([
            { startIndex: 0, scopes: ["k"] },
            { startIndex: 3, scopes: ["b"] },
            { startIndex: 7, scopes: ["n"] },
        ]);

        const rendered = renderToDSL(state);
        expect(rendered).toBe(dsl);
    });

    it("parses tokens with spaces (no token)", () => {
        const dsl = editorState`
            text: ab cd
            tokens: kk nn
        `;
        const state = parseDSL(dsl);
        const tokens = state.tokenStore?.getLineTokens(0);
        expect(tokens).toBeDefined();
        expect(tokens?.tokens).toEqual([
            { startIndex: 0, scopes: ["k"] },
            { startIndex: 3, scopes: ["n"] },
        ]);
    });

    it("roundtrips complex state with all tracks", () => {
        const dsl = editorState`
            text: let x = 5
            cursor:     █
            tokens: kkkbbbbnn
            text: return x
            tokens: kkkkkkkb
        `;
        const state = parseDSL(dsl);
        expect(state.document.lineCount).toBe(2);
        expect(state.selections[0].active).toEqual({ line: 0, character: 4 });
        expect(state.tokenStore?.getLineTokens(0)).toBeDefined();
        expect(state.tokenStore?.getLineTokens(1)).toBeDefined();

        const rendered = renderToDSL(state);
        expect(rendered).toBe(dsl);
    });

    // ─── Empty Document ─────────────────────────────────────

    it("handles empty text line", () => {
        const dsl = editorState`
            text:${" "}
            cursor: █
        `;
        const state = parseDSL(dsl);
        expect(state.document.getText()).toBe("");
        expect(state.selections[0].active).toEqual({ line: 0, character: 0 });
    });

    // ─── Tagged Template ────────────────────────────────────

    it("editorState tag dedents and trims", () => {
        const result = editorState`
            text: hello
            cursor: █
        `;
        expect(result).toBe("text: hello\ncursor: █");
    });

    // ─── expectEditorState ──────────────────────────────────

    it("expectEditorState passes on matching state", () => {
        const state = parseDSL(editorState`
            text: hello
            cursor:      █
        `);
        expectEditorState(
            state,
            `
            text: hello
            cursor:      █
        `,
        );
    });

    // ─── Integration: DSL → type() → DSL ────────────────────

    it("type a character and verify with DSL", () => {
        const state = parseDSL(editorState`
            text: hllo
            cursor:  █
        `);
        state.type("e");
        expectEditorState(
            state,
            `
            text: hello
            cursor:   █
        `,
        );
    });

    it("multi-cursor type and verify with DSL", () => {
        const state = parseDSL(editorState`
            text: aaa
            cursor: █
            text: bbb
            cursor: █
        `);
        state.type("X");
        expectEditorState(
            state,
            `
            text: Xaaa
            cursor:  █
            text: Xbbb
            cursor:  █
        `,
        );
    });

    it("type with newline and verify with DSL", () => {
        const state = parseDSL(editorState`
            text: helloworld
            cursor:      █
        `);
        state.insertNewLine();
        expectEditorState(
            state,
            `
            text: hello
            text: world
            cursor: █
        `,
        );
    });

    it("deleteLeft and verify with DSL", () => {
        const state = parseDSL(editorState`
            text: helllo
            cursor:    █
        `);
        state.deleteLeft();
        expectEditorState(
            state,
            `
            text: hello
            cursor:   █
        `,
        );
    });

    // ─── Folding Track ──────────────────────────────────────

    it("parses expanded folding region with v/|/^", () => {
        const state = parseDSL(editorState`
            text: function foo() {
            folding: v
            text:   console.log(1);
            folding: |
            text: }
            folding: ^
        `);
        expect(state.foldedRegions).toHaveLength(1);
        expect(state.foldedRegions[0]).toEqual({
            startLine: 0,
            endLine: 2,
            isCollapsed: false,
        });
    });

    it("parses collapsed folding region with >/|/^", () => {
        const state = parseDSL(editorState`
            text: function foo() {
            folding: >
            text:   console.log(1);
            folding: |
            text: }
            folding: ^
        `);
        expect(state.foldedRegions).toHaveLength(1);
        expect(state.foldedRegions[0]).toEqual({
            startLine: 0,
            endLine: 2,
            isCollapsed: true,
        });
    });

    it("parses multiple folding regions", () => {
        const state = parseDSL(editorState`
            text: a
            folding: v
            text: b
            folding: ^
            text: c
            folding: >
            text: d
            folding: ^
        `);
        expect(state.foldedRegions).toHaveLength(2);
        expect(state.foldedRegions[0]).toEqual({ startLine: 0, endLine: 1, isCollapsed: false });
        expect(state.foldedRegions[1]).toEqual({ startLine: 2, endLine: 3, isCollapsed: true });
    });

    it("roundtrips folding track with expanded region", () => {
        const dsl = editorState`
            text: a
            cursor: █
            folding: v
            text: b
            folding: |
            text: c
            folding: ^
        `;
        const state = parseDSL(dsl);
        const rendered = renderToDSL(state);
        expect(rendered).toBe(dsl);
    });

    it("roundtrips folding track with collapsed region", () => {
        const dsl = editorState`
            text: a
            cursor: █
            folding: >
            text: b
            folding: |
            text: c
            folding: ^
        `;
        const state = parseDSL(dsl);
        const rendered = renderToDSL(state);
        expect(rendered).toBe(dsl);
    });

    it("renders state with no folding regions (no folding track)", () => {
        const dsl = editorState`
            text: hello
            cursor: █
        `;
        const state = parseDSL(dsl);
        const rendered = renderToDSL(state);
        expect(rendered).toBe(dsl); // no folding: lines
    });

    it("parses nested folding regions", () => {
        const state = parseDSL(editorState`
            text: outer start
            folding: v
            text:   inner start
            folding: v
            text:     body
            folding: |
            text:   inner end
            folding: ^
            text: outer end
            folding: ^
        `);
        expect(state.foldedRegions).toHaveLength(2);
        // Stack-based parsing: inner closes first, outer closes second
        // Sorted by startLine, inner (1-3) comes first, outer (0-4) comes second
        const sorted = [...state.foldedRegions].sort((a, b) => a.startLine - b.startLine);
        expect(sorted[0]).toEqual({ startLine: 0, endLine: 4, isCollapsed: false });
        expect(sorted[1]).toEqual({ startLine: 1, endLine: 3, isCollapsed: false });
    });

    // ─── Select track rendering ─────────────────────────────

    it("renders a select track for a single-line selection", () => {
        // Build a state with a forward selection covering "world" in "hello world".
        const doc = new TextDocument("hello world");
        const state = new EditorViewState(doc, [createSelection(0, 6, 0, 11)]);

        const rendered = renderToDSL(state);

        // The select track marks columns 6..11 with ░ and the cursor sits at 11.
        expect(rendered).toBe(["text: hello world", "cursor:            █", "select:       ░░░░░"].join("\n"));
    });

    it("round-trips a single-line selection through parse and render", () => {
        const dsl = editorState`
            text: hello world
            cursor:            █
            select:       ░░░░░
        `;
        const state = parseDSL(dsl);
        expect(renderToDSL(state)).toBe(dsl);
    });

    it("renders a multi-line selection filling whole intermediate lines", () => {
        // Selection spans from line 0 col 2 to line 2 col 1. The middle line
        // is filled from col 0 to its full content length.
        const doc = new TextDocument("aaaa\nbbbb\ncccc");
        const state = new EditorViewState(doc, [createSelection(0, 2, 2, 1)]);

        const rendered = renderToDSL(state);
        const lines = rendered.split("\n");

        // Line 0: ░ starts at col 2.
        expect(lines).toContain("select:   ░░");
        // Middle line (line 1) is fully selected — 4 ░.
        expect(lines).toContain("select: ░░░░");
    });

    it("renders a selection whose end character exceeds the line content length", () => {
        // The active end sits past the end of the short line "ab" (length 2).
        // The select-track renderer grows the char buffer via chars.push to mark
        // those out-of-content columns.
        const doc = new TextDocument("ab");
        const state = new EditorViewState(doc, [createSelection(0, 0, 0, 5)]);

        const rendered = renderToDSL(state);
        const lines = rendered.split("\n");

        const selectLine = lines.find((l) => l.startsWith("select:"));
        expect(selectLine).toBeDefined();
        // 5 ░ characters — extended two columns beyond the 2-char line content.
        expect(selectLine).toBe("select: ░░░░░");
    });

    // ─── Selection without a cursor track ───────────────────

    it("parses a select track that has no accompanying cursor as a forward selection", () => {
        const state = parseDSL(editorState`
            text: hello world
            select:       ░░░░░
        `);
        expect(state.selections).toHaveLength(1);
        const sel = state.selections[0];
        // No cursor → anchor at start, active at end of the ░ run.
        expect(sel.anchor).toEqual({ line: 0, character: 6 });
        expect(sel.active).toEqual({ line: 0, character: 11 });
    });

    // ─── Empty token track ──────────────────────────────────

    it("parses an empty tokens track as no tokens", () => {
        // The tokens track is present but empty after the prefix → createLineTokens([]).
        const state = parseDSL(editorState`
            text: hello
            tokens:${""}
        `);
        // Empty token list → store not created, so no tokens for line 0.
        expect(state.tokenStore?.getLineTokens(0)?.tokens ?? []).toEqual([]);
    });

    // ─── dedentAndTrim with only blank lines ────────────────

    it("editorState of an all-blank template yields an empty string", () => {
        // All lines blank → minIndent stays Infinity and is reset to 0.
        const result = editorState`



        `;
        expect(result).toBe("");
    });
});
