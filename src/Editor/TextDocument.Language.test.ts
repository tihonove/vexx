import { describe, expect, it } from "vitest";

import type { IDocumentLanguageChange } from "./IDocumentLanguageChange.ts";

import { TextDocument } from "./TextDocument.ts";

describe("TextDocument — language", () => {
    it("по умолчанию язык plaintext", () => {
        const doc = new TextDocument("hello");
        expect(doc.languageId).toBe("plaintext");
    });

    it("принимает язык в конструкторе", () => {
        const doc = new TextDocument("const x = 1;", "typescript");
        expect(doc.languageId).toBe("typescript");
    });

    it("setLanguage меняет язык и эмитит событие со старым и новым id", () => {
        const doc = new TextDocument("", "plaintext");
        const changes: IDocumentLanguageChange[] = [];
        doc.onDidChangeLanguage((change) => changes.push(change));

        doc.setLanguage("markdown");

        expect(doc.languageId).toBe("markdown");
        expect(changes).toEqual([{ oldLanguageId: "plaintext", newLanguageId: "markdown" }]);
    });

    it("setLanguage с тем же id — no-op без события", () => {
        const doc = new TextDocument("", "markdown");
        let fired = 0;
        doc.onDidChangeLanguage(() => fired++);

        doc.setLanguage("markdown");

        expect(fired).toBe(0);
        expect(doc.languageId).toBe("markdown");
    });

    it("setLanguage не меняет versionId (документ не становится dirty)", () => {
        const doc = new TextDocument("text");
        const before = doc.versionId;
        doc.setLanguage("python");
        expect(doc.versionId).toBe(before);
    });

    it("dispose подписки останавливает доставку, повторный dispose — no-op", () => {
        const doc = new TextDocument("");
        let fired = 0;
        const subscription = doc.onDidChangeLanguage(() => fired++);
        const other = doc.onDidChangeLanguage(() => undefined);

        doc.setLanguage("json");
        subscription.dispose();
        subscription.dispose();
        doc.setLanguage("yaml");

        expect(fired).toBe(1);
        other.dispose();
    });
});
