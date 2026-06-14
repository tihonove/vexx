import { describe, expect, it } from "vitest";

import { createDeleteEdit } from "../ITextEdit.ts";
import { TextDocument } from "../TextDocument.ts";

import { PlainTextTokenizer } from "./builtin/PlainTextTokenizer.ts";
import { DocumentTokenStore } from "./DocumentTokenStore.ts";

describe("DocumentTokenStore.getEndState", () => {
    it("returns the cached end state of a tokenized line", () => {
        const doc = new TextDocument("a\nb\nc");
        const store = new DocumentTokenStore(doc, new PlainTextTokenizer());

        // Before tokenization there is no cached end state.
        expect(store.getEndState(0)).toBeUndefined();

        store.tokenizeUpTo(2);

        // PlainTextTokenizer is stateless, so every line ends in the NULL_STATE singleton.
        const s0 = store.getEndState(0);
        expect(s0).toBeDefined();
        expect(s0!.equals(s0!)).toBe(true);
        expect(store.getEndState(2)).toBeDefined();
    });
});

describe("DocumentTokenStore.handleContentChange — invalidLineIndex clamp", () => {
    it("clamps invalidLineIndex down to the new lineCount after a multi-line delete", () => {
        const doc = new TextDocument("a\nb\nc\nd\ne");
        const store = new DocumentTokenStore(doc, new PlainTextTokenizer());

        // Drive invalidLineIndex up to lineCount (5) via the end-state convergence
        // optimisation: a stateless tokenizer converges on line 0 and jumps to EOF.
        store.tokenizeUpTo(4);
        expect(store.invalidLineIndex).toBe(5);

        // Delete lines 2..4 (range (2,0)-(4,0)). startLine (2) is below the current
        // invalidLineIndex, so it drops to 2 — but afterwards the final clamp keeps it
        // within [0, lineCount]. Verify it never exceeds the shrunken document.
        doc.applyEdits([createDeleteEdit(2, 0, 4, 0)]);
        expect(store.invalidLineIndex).toBeLessThanOrEqual(doc.lineCount);
        expect(store.invalidLineIndex).toBe(2);
    });

    it("never reports invalidLineIndex past EOF when an edit touches the last line", () => {
        const doc = new TextDocument("a\nb\nc");
        const store = new DocumentTokenStore(doc, new PlainTextTokenizer());
        store.tokenizeUpTo(2);
        expect(store.invalidLineIndex).toBe(3);

        // Delete the final two lines, collapsing onto line 0.
        doc.applyEdits([createDeleteEdit(0, 1, 2, 1)]);
        expect(store.invalidLineIndex).toBeLessThanOrEqual(doc.lineCount);
    });
});

describe("DocumentTokenStore.emptyLineTokens", () => {
    it("returns a single whole-line token with empty scopes", () => {
        const empty = DocumentTokenStore.emptyLineTokens();
        expect(empty.tokens).toEqual([{ startIndex: 0, scopes: [] }]);
    });

    it("returns the same shared singleton on every call", () => {
        expect(DocumentTokenStore.emptyLineTokens()).toBe(DocumentTokenStore.emptyLineTokens());
    });
});
