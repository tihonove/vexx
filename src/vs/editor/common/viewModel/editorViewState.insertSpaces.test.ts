import { describe, expect, it } from "vitest";

import { createCursorSelection } from "../core/iSelection.ts";
import { TextDocument } from "../model/textDocument.ts";

import { EditorViewState } from "./editorViewState.ts";

function createState(
    text: string,
    options: { insertSpaces?: boolean; tabSize?: number; detectIndentation?: boolean } = {},
): EditorViewState {
    const state = new EditorViewState(new TextDocument(text));
    if (options.detectIndentation !== undefined) {
        state.detectIndentation = options.detectIndentation;
    }
    if (options.insertSpaces !== undefined) {
        state.insertSpaces = options.insertSpaces;
    }
    if (options.tabSize !== undefined) {
        state.tabSize = options.tabSize;
    }
    return state;
}

describe("indentLines – insertSpaces=false", () => {
    it("inserts a \\t character", () => {
        const state = createState("hello", { insertSpaces: false });
        state.selections = [createCursorSelection(0, 0)];
        state.indentLines();
        expect(state.document.getText()).toBe("\thello");
    });
});

describe("indentLines – insertSpaces=true", () => {
    it("inserts 2 spaces when tabSize=2", () => {
        const state = createState("hello", { insertSpaces: true, tabSize: 2 });
        state.selections = [createCursorSelection(0, 0)];
        state.indentLines();
        expect(state.document.getText()).toBe("  hello");
    });

    it("inserts 4 spaces when tabSize=4", () => {
        const state = createState("hello", { insertSpaces: true, tabSize: 4 });
        state.selections = [createCursorSelection(0, 0)];
        state.indentLines();
        expect(state.document.getText()).toBe("    hello");
    });

    it("inserts spaces at cursor position mid-line", () => {
        const state = createState("ab", { insertSpaces: true, tabSize: 2 });
        state.selections = [createCursorSelection(0, 1)];
        state.indentLines();
        expect(state.document.getText()).toBe("a  b");
    });
});

describe("detectIndentation drives the indent unit", () => {
    it("auto-detects 2-space indentation and uses spaces on indent", () => {
        const state = createState("function foo() {\n  const x = 1;\n  return x;\n}", { detectIndentation: true });

        expect(state.insertSpaces).toBe(true);
        expect(state.tabSize).toBe(2);

        state.selections = [createCursorSelection(0, 0)];
        state.indentLines();
        expect(state.document.getText().startsWith("  ")).toBe(true);
    });

    it("auto-detects 4-space indentation", () => {
        const state = createState("function foo() {\n    const x = 1;\n    return x;\n}", { detectIndentation: true });

        expect(state.insertSpaces).toBe(true);
        expect(state.tabSize).toBe(4);
    });

    it("auto-detects tab indentation and uses tabs on indent", () => {
        const state = createState("function foo() {\n\tconst x = 1;\n\treturn x;\n}", { detectIndentation: true });

        expect(state.insertSpaces).toBe(false);

        state.selections = [createCursorSelection(0, 0)];
        state.indentLines();
        expect(state.document.getText().startsWith("\t")).toBe(true);
    });

    it("does not override insertSpaces when detectIndentation=false", () => {
        const state = createState("function foo() {\n  const x = 1;\n}", {
            detectIndentation: false,
            insertSpaces: false,
        });

        expect(state.insertSpaces).toBe(false);

        state.selections = [createCursorSelection(0, 0)];
        state.indentLines();
        expect(state.document.getText().startsWith("\t")).toBe(true);
    });
});
