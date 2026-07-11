import { describe, expect, it } from "vitest";

import { CompletionItem, CompletionItemKind, EndOfLine, FileType, TextDocumentSaveReason } from "./VscodeTypes.ts";

describe("VscodeTypes — enums", () => {
    it("EndOfLine", () => {
        expect(EndOfLine.LF).toBe(1);
        expect(EndOfLine.CRLF).toBe(2);
    });

    it("TextDocumentSaveReason", () => {
        expect(TextDocumentSaveReason.Manual).toBe(1);
        expect(TextDocumentSaveReason.AfterDelay).toBe(2);
        expect(TextDocumentSaveReason.FocusOut).toBe(3);
    });

    it("FileType", () => {
        expect(FileType.Unknown).toBe(0);
        expect(FileType.File).toBe(1);
        expect(FileType.Directory).toBe(2);
        expect(FileType.SymbolicLink).toBe(64);
    });

    it("CompletionItemKind spot-check", () => {
        expect(CompletionItemKind.Text).toBe(0);
        expect(CompletionItemKind.Property).toBe(9);
        expect(CompletionItemKind.Issue).toBe(26);
    });
});

describe("VscodeTypes — CompletionItem", () => {
    it("конструктор задаёт label и kind", () => {
        const item = new CompletionItem("indent_size", CompletionItemKind.Property);
        expect(item.label).toBe("indent_size");
        expect(item.kind).toBe(CompletionItemKind.Property);
        expect(item.insertText).toBeUndefined();
    });
});
