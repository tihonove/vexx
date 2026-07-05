import type * as vscode from "vscode";
import { describe, expect, it } from "vitest";

import { matchDocumentSelector } from "./DocumentSelector.ts";
import { DocumentRegistry } from "./ExtHostDocuments.ts";

function doc(fileName: string, languageId: string) {
    const registry = new DocumentRegistry();
    return registry.upsertMeta({ fileName, languageId });
}

describe("matchDocumentSelector", () => {
    const editorconfig = doc("/home/u/proj/.editorconfig", "editorconfig");

    it("строковый селектор — сахар для language", () => {
        expect(matchDocumentSelector("editorconfig", editorconfig)).toBe(true);
        expect(matchDocumentSelector("ini", editorconfig)).toBe(false);
    });

    it("'*' матчит любой язык", () => {
        expect(matchDocumentSelector("*", editorconfig)).toBe(true);
        expect(matchDocumentSelector({ language: "*" } as vscode.DocumentFilter, editorconfig)).toBe(true);
    });

    it("language-фильтр", () => {
        expect(matchDocumentSelector({ language: "editorconfig" } as vscode.DocumentFilter, editorconfig)).toBe(true);
        expect(matchDocumentSelector({ language: "ini" } as vscode.DocumentFilter, editorconfig)).toBe(false);
    });

    it("scheme по умолчанию file", () => {
        expect(matchDocumentSelector({ scheme: "file" } as vscode.DocumentFilter, editorconfig)).toBe(true);
        expect(matchDocumentSelector({ scheme: "untitled" } as vscode.DocumentFilter, editorconfig)).toBe(false);
    });

    it("pattern glob со globstar", () => {
        const sel = { language: "editorconfig", pattern: "**/.editorconfig" } as vscode.DocumentFilter;
        expect(matchDocumentSelector(sel, editorconfig)).toBe(true);
        expect(matchDocumentSelector(sel, doc("/home/u/proj/foo.txt", "editorconfig"))).toBe(false);
    });

    it("pattern '*' внутри одного сегмента не пересекает /", () => {
        const sel = { pattern: "/home/u/proj/*.ts" } as vscode.DocumentFilter;
        expect(matchDocumentSelector(sel, doc("/home/u/proj/a.ts", "typescript"))).toBe(true);
        expect(matchDocumentSelector(sel, doc("/home/u/proj/sub/a.ts", "typescript"))).toBe(false);
    });

    it("массив — any-match", () => {
        const sel = ["ini", { language: "editorconfig" }] as vscode.DocumentSelector;
        expect(matchDocumentSelector(sel, editorconfig)).toBe(true);
        expect(matchDocumentSelector(["ini", "xml"] as vscode.DocumentSelector, editorconfig)).toBe(false);
    });

    it("пустой фильтр не матчит", () => {
        expect(matchDocumentSelector({} as vscode.DocumentFilter, editorconfig)).toBe(false);
    });
});
