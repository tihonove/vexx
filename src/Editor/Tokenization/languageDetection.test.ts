import { describe, expect, it } from "vitest";

import { getLanguageIdForFile } from "./languageDetection.ts";

describe("getLanguageIdForFile", () => {
    it("возвращает 'plaintext' для null", () => {
        expect(getLanguageIdForFile(null)).toBe("plaintext");
    });

    it("возвращает 'plaintext' для файла без расширения", () => {
        expect(getLanguageIdForFile("/some/Makefile")).toBe("plaintext");
    });

    it("возвращает 'plaintext' для незнакомого расширения", () => {
        expect(getLanguageIdForFile("foo.unknown")).toBe("plaintext");
    });

    it.each([
        [".js", "javascript"],
        [".cjs", "javascript"],
        [".mjs", "javascript"],
        [".jsx", "javascriptreact"],
        [".ts", "typescript"],
        [".cts", "typescript"],
        [".mts", "typescript"],
        [".tsx", "typescriptreact"],
        [".html", "html"],
        [".htm", "html"],
        [".css", "css"],
    ])("маппит %s → %s", (ext, expected) => {
        expect(getLanguageIdForFile(`file${ext}`)).toBe(expected);
    });

    it("регистронезависим к расширению", () => {
        expect(getLanguageIdForFile("file.TS")).toBe("typescript");
        expect(getLanguageIdForFile("file.HTML")).toBe("html");
    });
});
