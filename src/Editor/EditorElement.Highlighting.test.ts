import { describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { EditorElement } from "./EditorElement.ts";
import { EditorViewState } from "./EditorViewState.ts";
import { TextDocument } from "./TextDocument.ts";
import { DocumentTokenStore } from "./Tokenization/DocumentTokenStore.ts";
import { WordTokenizer } from "./Tokenization/builtin/WordTokenizer.ts";
import type { ITokenStyleResolver, ResolvedTokenStyle } from "./Tokenization/ITokenStyleResolver.ts";
import { EMPTY_RESOLVED_TOKEN_STYLE } from "./Tokenization/ITokenStyleResolver.ts";

const KEYWORD_FG = packRgb(255, 0, 0);
const NUMBER_FG = packRgb(0, 255, 0);

class StubResolver implements ITokenStyleResolver {
    public resolve(scopes: readonly string[]): ResolvedTokenStyle {
        for (let i = scopes.length - 1; i >= 0; i--) {
            if (scopes[i] === "keyword.control") return { ...EMPTY_RESOLVED_TOKEN_STYLE, fg: KEYWORD_FG };
            if (scopes[i] === "constant.numeric") return { ...EMPTY_RESOLVED_TOKEN_STYLE, fg: NUMBER_FG };
        }
        return EMPTY_RESOLVED_TOKEN_STYLE;
    }
}

function createHighlightedEditor(text: string, width = 40, height = 4): {
    app: TestApp;
    editor: EditorElement;
    doc: TextDocument;
    gw: number;
} {
    const doc = new TextDocument(text);
    const viewState = new EditorViewState(doc);
    const store = new DocumentTokenStore(doc, new WordTokenizer());
    viewState.tokenStore = store;
    const editor = new EditorElement(viewState);
    editor.tokenStyleResolver = new StubResolver();
    const app = TestApp.createWithContent(editor, new Size(width, height));
    return { app, editor, doc, gw: editor.gutterWidth };
}

describe("EditorElement syntax highlighting", () => {
    it("colours a keyword cell with the resolver's foreground", () => {
        const { app, gw } = createHighlightedEditor("if x");
        app.render();
        // "if" starts at column 0 of the content area
        expect(app.backend.getFgAt(new Point(gw, 0))).toBe(KEYWORD_FG);
        expect(app.backend.getFgAt(new Point(gw + 1, 0))).toBe(KEYWORD_FG);
    });

    it("colours a numeric literal cell with the resolver's foreground", () => {
        const { app, gw } = createHighlightedEditor("123");
        app.render();
        expect(app.backend.getFgAt(new Point(gw, 0))).toBe(NUMBER_FG);
        expect(app.backend.getFgAt(new Point(gw + 1, 0))).toBe(NUMBER_FG);
        expect(app.backend.getFgAt(new Point(gw + 2, 0))).toBe(NUMBER_FG);
    });

    it("falls back to the editor foreground for tokens with no rule", () => {
        const { app, editor, gw } = createHighlightedEditor("foo");
        app.render();
        expect(app.backend.getFgAt(new Point(gw, 0))).toBe(editor.resolvedStyle.fg);
    });

    it("re-tokenizes on edit and updates colours", () => {
        const { app, doc, gw } = createHighlightedEditor("foo");
        app.render();
        doc.applyEdits([
            { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } }, text: "if" },
        ]);
        app.render();
        expect(app.backend.getFgAt(new Point(gw, 0))).toBe(KEYWORD_FG);
    });
});
