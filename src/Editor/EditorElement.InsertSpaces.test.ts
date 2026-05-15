import { describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { EditorElement } from "./EditorElement.ts";
import { EditorViewState } from "./EditorViewState.ts";
import { TextDocument } from "./TextDocument.ts";

function createEditor(
    text: string,
    options: { insertSpaces?: boolean; tabSize?: number; detectIndentation?: boolean } = {},
    width = 30,
    height = 5,
): { app: TestApp; editor: EditorElement } {
    const doc = new TextDocument(text);
    const viewState = new EditorViewState(doc);
    if (options.detectIndentation !== undefined) {
        viewState.detectIndentation = options.detectIndentation;
    }
    if (options.insertSpaces !== undefined) {
        viewState.insertSpaces = options.insertSpaces;
    }
    if (options.tabSize !== undefined) {
        viewState.tabSize = options.tabSize;
    }
    const editor = new EditorElement(viewState);
    const app = TestApp.createWithContent(editor, new Size(width, height));
    editor.focus();
    return { app, editor };
}

describe("EditorElement – Tab with insertSpaces=false", () => {
    it("inserts \\t character", () => {
        const { app, editor } = createEditor("hello", { insertSpaces: false });

        app.sendKey("Tab");

        expect(editor.viewState.document.getText()).toBe("\thello");
    });
});

describe("EditorElement – Tab with insertSpaces=true", () => {
    it("inserts 2 spaces when tabSize=2", () => {
        const { app, editor } = createEditor("hello", { insertSpaces: true, tabSize: 2 });

        app.sendKey("Tab");

        expect(editor.viewState.document.getText()).toBe("  hello");
    });

    it("inserts 4 spaces when tabSize=4", () => {
        const { app, editor } = createEditor("hello", { insertSpaces: true, tabSize: 4 });

        app.sendKey("Tab");

        expect(editor.viewState.document.getText()).toBe("    hello");
    });

    it("inserts spaces at cursor position mid-line", () => {
        const { app, editor } = createEditor("ab", { insertSpaces: true, tabSize: 2 });
        editor.viewState.selections = [
            { anchor: { line: 0, character: 1 }, active: { line: 0, character: 1 }, idealColumn: 1 },
        ];

        app.sendKey("Tab");

        expect(editor.viewState.document.getText()).toBe("a  b");
    });
});

describe("EditorElement – detectIndentation", () => {
    it("auto-detects 2-space indentation and uses spaces on Tab", () => {
        const indentedText = "function foo() {\n  const x = 1;\n  return x;\n}";
        const { app, editor } = createEditor(indentedText, { detectIndentation: true });

        expect(editor.viewState.insertSpaces).toBe(true);
        expect(editor.viewState.tabSize).toBe(2);

        editor.viewState.selections = [
            { anchor: { line: 0, character: 0 }, active: { line: 0, character: 0 }, idealColumn: 0 },
        ];
        app.sendKey("Tab");

        expect(editor.viewState.document.getText().startsWith("  ")).toBe(true);
    });

    it("auto-detects 4-space indentation and uses spaces on Tab", () => {
        const indentedText = "function foo() {\n    const x = 1;\n    return x;\n}";
        const { app, editor } = createEditor(indentedText, { detectIndentation: true });

        expect(editor.viewState.insertSpaces).toBe(true);
        expect(editor.viewState.tabSize).toBe(4);
    });

    it("auto-detects tab indentation and uses tabs on Tab", () => {
        const indentedText = "function foo() {\n\tconst x = 1;\n\treturn x;\n}";
        const { app, editor } = createEditor(indentedText, { detectIndentation: true });

        expect(editor.viewState.insertSpaces).toBe(false);

        editor.viewState.selections = [
            { anchor: { line: 0, character: 0 }, active: { line: 0, character: 0 }, idealColumn: 0 },
        ];
        app.sendKey("Tab");

        expect(editor.viewState.document.getText().startsWith("\t")).toBe(true);
    });

    it("does not override insertSpaces when detectIndentation=false", () => {
        const indentedText = "function foo() {\n  const x = 1;\n}";
        const { app, editor } = createEditor(indentedText, { detectIndentation: false, insertSpaces: false });

        expect(editor.viewState.insertSpaces).toBe(false);

        editor.viewState.selections = [
            { anchor: { line: 0, character: 0 }, active: { line: 0, character: 0 }, idealColumn: 0 },
        ];
        app.sendKey("Tab");

        expect(editor.viewState.document.getText().startsWith("\t")).toBe(true);
    });
});
