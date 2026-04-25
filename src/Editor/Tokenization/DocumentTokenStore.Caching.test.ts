import { describe, expect, it, vi } from "vitest";

import { TextDocument } from "../TextDocument.ts";

import { PlainTextTokenizer } from "./builtin/PlainTextTokenizer.ts";
import { DocumentTokenStore } from "./DocumentTokenStore.ts";

describe("DocumentTokenStore caching", () => {
    it("returns undefined for lines that have not been tokenized yet", () => {
        const doc = new TextDocument("a\nb\nc");
        const store = new DocumentTokenStore(doc, new PlainTextTokenizer());
        expect(store.getLineTokens(0)).toBeUndefined();
        expect(store.getLineTokens(2)).toBeUndefined();
    });

    it("tokenizeUpTo populates the cache for [0..targetLine]", () => {
        const doc = new TextDocument("a\nb\nc");
        const store = new DocumentTokenStore(doc, new PlainTextTokenizer());
        store.tokenizeUpTo(1);
        expect(store.getLineTokens(0)).toBeDefined();
        expect(store.getLineTokens(1)).toBeDefined();
        expect(store.getLineTokens(2)).toBeUndefined();
    });

    it("does not call the tokenizer twice for the same line", () => {
        const doc = new TextDocument("hello\nworld");
        const tokenizer = new PlainTextTokenizer();
        const spy = vi.spyOn(tokenizer, "tokenizeLine");
        const store = new DocumentTokenStore(doc, tokenizer);
        store.tokenizeUpTo(1);
        const callsAfterFirst = spy.mock.calls.length;
        store.tokenizeUpTo(1);
        expect(spy.mock.calls.length).toBe(callsAfterFirst);
    });

    it("setLineTokens overrides cached tokens", () => {
        const doc = new TextDocument("a\nb");
        const store = new DocumentTokenStore(doc, new PlainTextTokenizer());
        store.tokenizeUpTo(0);
        store.setLineTokens(0, { tokens: [{ startIndex: 0, scopes: ["custom"] }] });
        expect(store.getLineTokens(0)?.tokens[0].scopes).toEqual(["custom"]);
    });

    it("getLineTokens returns undefined for out-of-range indices", () => {
        const doc = new TextDocument("a");
        const store = new DocumentTokenStore(doc, new PlainTextTokenizer());
        store.tokenizeUpTo(0);
        expect(store.getLineTokens(-1)).toBeUndefined();
        expect(store.getLineTokens(1)).toBeUndefined();
    });
});
