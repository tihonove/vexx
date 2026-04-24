import { describe, expect, it } from "vitest";

import type { IDocumentContentChange } from "./IDocumentContentChange.ts";
import { createDeleteEdit, createInsertEdit } from "./ITextEdit.ts";
import { TextDocument } from "./TextDocument.ts";

function recordChanges(doc: TextDocument): IDocumentContentChange[] {
    const changes: IDocumentContentChange[] = [];
    doc.onDidChangeContent((c) => changes.push(c));
    return changes;
}

describe("TextDocument change events", () => {
    it("setText fires a single full-replace change", () => {
        const doc = new TextDocument("a\nb\nc");
        const changes = recordChanges(doc);
        doc.setText("X\nY");
        expect(changes).toEqual([{ startLine: 0, oldEndLine: 2, newEndLine: 1 }]);
    });

    it("single-line insert reports unchanged line range", () => {
        const doc = new TextDocument("hello");
        const changes = recordChanges(doc);
        doc.applyEdits([createInsertEdit(0, 5, " world")]);
        expect(changes).toEqual([{ startLine: 0, oldEndLine: 0, newEndLine: 0 }]);
    });

    it("multi-line insert grows the line range", () => {
        const doc = new TextDocument("ab");
        const changes = recordChanges(doc);
        doc.applyEdits([createInsertEdit(0, 1, "X\nY\n")]);
        // After insert: "aX", "Y", "b" — startLine=0, oldEndLine=0, newEndLine=2
        expect(changes).toEqual([{ startLine: 0, oldEndLine: 0, newEndLine: 2 }]);
    });

    it("multi-line delete shrinks the line range", () => {
        const doc = new TextDocument("a\nb\nc\nd");
        const changes = recordChanges(doc);
        doc.applyEdits([createDeleteEdit(1, 0, 3, 0)]);
        expect(changes).toEqual([{ startLine: 1, oldEndLine: 3, newEndLine: 1 }]);
    });

    it("applyEdits with multiple edits emits one change per edit", () => {
        const doc = new TextDocument("a\nb\nc");
        const changes = recordChanges(doc);
        doc.applyEdits([createInsertEdit(0, 0, "X"), createInsertEdit(2, 0, "Y")]);
        expect(changes.length).toBe(2);
    });

    it("returned IDisposable removes the listener", () => {
        const doc = new TextDocument("a");
        const changes: IDocumentContentChange[] = [];
        const handle = doc.onDidChangeContent((c) => changes.push(c));
        doc.applyEdits([createInsertEdit(0, 0, "X")]);
        handle.dispose();
        doc.applyEdits([createInsertEdit(0, 0, "Y")]);
        expect(changes.length).toBe(1);
    });
});
