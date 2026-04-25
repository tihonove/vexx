import { describe, expect, it } from "vitest";

import { createInsertEdit } from "../ITextEdit.ts";
import { TextDocument } from "../TextDocument.ts";

import { PlainTextTokenizer } from "./builtin/PlainTextTokenizer.ts";
import { DocumentTokenStore } from "./DocumentTokenStore.ts";

describe("DocumentTokenStore invalidation", () => {
    it("invalidates the edited line on a single-line edit", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const store = new DocumentTokenStore(doc, new PlainTextTokenizer());
        store.tokenizeUpTo(2);
        expect(store.getLineTokens(1)).toBeDefined();

        doc.applyEdits([createInsertEdit(1, 1, "X")]);

        expect(store.getLineTokens(1)).toBeUndefined();
        // Lines outside the change keep their cached tokens.
        expect(store.getLineTokens(0)).toBeDefined();
        expect(store.getLineTokens(2)).toBeDefined();
    });

    it("lowers invalidLineIndex to the change's startLine", () => {
        const doc = new TextDocument("aaa\nbbb\nccc");
        const store = new DocumentTokenStore(doc, new PlainTextTokenizer());
        store.tokenizeUpTo(2);
        expect(store.invalidLineIndex).toBe(doc.lineCount);

        doc.applyEdits([createInsertEdit(1, 0, "Z")]);
        expect(store.invalidLineIndex).toBe(1);
    });

    it("invalidates every line in the changed range on a multi-line insert", () => {
        const doc = new TextDocument("a\nb\nc");
        const store = new DocumentTokenStore(doc, new PlainTextTokenizer());
        store.tokenizeUpTo(2);

        doc.applyEdits([createInsertEdit(1, 0, "X\nY\n")]);
        // After insert: a, X, Y, b, c
        expect(store.getLineTokens(1)).toBeUndefined();
        expect(store.getLineTokens(2)).toBeUndefined();
        expect(store.getLineTokens(3)).toBeUndefined();
        // Line 0 and the line after the inserted block are still valid.
        expect(store.getLineTokens(0)).toBeDefined();
        expect(store.getLineTokens(4)).toBeDefined();
    });

    it("setTokenizationSupport invalidates the entire cache", () => {
        const doc = new TextDocument("a\nb\nc");
        const store = new DocumentTokenStore(doc, new PlainTextTokenizer());
        store.tokenizeUpTo(2);
        expect(store.invalidLineIndex).toBe(doc.lineCount);

        store.setTokenizationSupport(new PlainTextTokenizer());

        expect(store.invalidLineIndex).toBe(0);
        expect(store.getLineTokens(0)).toBeUndefined();
    });
});
