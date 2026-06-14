import { describe, expect, it } from "vitest";

import { createRange } from "./IRange.ts";
import { createTextEdit } from "./ITextEdit.ts";
import { TextDocument } from "./TextDocument.ts";

describe("TextDocument.applyEdits — same-start tie-breaking", () => {
    it("orders two edits sharing a start by their end position when collecting old texts", () => {
        // Two edits at the same start (0,2): a zero-width insert (end 0,2) and a
        // replace covering (0,2)-(0,4). The doc-order sort tie-breaks on end
        // position (TextDocument.ts:94) so the inverse edits restore correctly.
        const doc = new TextDocument("abcdef");
        const insert = createTextEdit(createRange(0, 2, 0, 2), "X");
        const replace = createTextEdit(createRange(0, 2, 0, 4), "YY");

        const { inverseEdits } = doc.applyEdits([replace, insert]);

        // Insert "X" at 2, replace "cd" with "YY" → "abXYYef".
        expect(doc.getText()).toBe("abXYYef");

        // Undo: applying the inverse edits must restore the original document.
        const restored = new TextDocument("abXYYef");
        restored.applyEdits(inverseEdits);
        expect(restored.getText()).toBe("abcdef");
    });

    it("reverse-application sort tie-breaks on end position so both edits land safely", () => {
        // Same start (0,0): a zero-width insert and a replace of the first char.
        // Exercises the reverse-order sort end-position tie-break (TextDocument.ts:104).
        const doc = new TextDocument("hello");
        const insert = createTextEdit(createRange(0, 0, 0, 0), ">");
        const replace = createTextEdit(createRange(0, 0, 0, 1), "H");

        doc.applyEdits([insert, replace]);

        // Both edits start at 0; applying bottom-up keeps coordinates valid.
        expect(doc.getText()).toBe(">Hello");
    });

    it("produces inverse edits that round-trip when starts collide", () => {
        const doc = new TextDocument("0123456789");
        const a = createTextEdit(createRange(0, 5, 0, 5), "AA");
        const b = createTextEdit(createRange(0, 5, 0, 7), "B");

        const { inverseEdits } = doc.applyEdits([a, b]);
        const after = doc.getText();
        expect(after).not.toBe("0123456789");

        const replay = new TextDocument(after);
        replay.applyEdits(inverseEdits);
        expect(replay.getText()).toBe("0123456789");
    });
});
