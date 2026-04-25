import { describe, expect, it } from "vitest";

import type { IExtension } from "./IExtension.ts";
import { LanguageRegistry } from "./LanguageRegistry.ts";

function makeExt(id: string, languages: object[], location = "/ext"): IExtension {
    return {
        id,
        location,
        isBuiltin: true,
        manifest: {
            name: id,
            publisher: "vscode",
            version: "1.0.0",
            engines: { vscode: "*" },
            contributes: { languages: languages as never },
        },
    };
}

describe("LanguageRegistry", () => {
    it("регистрирует язык и возвращает его по id", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt("ts", [{ id: "typescript", extensions: [".ts"], aliases: ["TypeScript"] }]));

        const lang = registry.getLanguage("typescript");
        expect(lang?.id).toBe("typescript");
        expect(lang?.extensions).toEqual([".ts"]);
        expect(lang?.aliases).toEqual(["TypeScript"]);
    });

    it("matches по точному filename", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt("docker", [{ id: "dockerfile", filenames: ["Dockerfile"] }]));

        expect(registry.getLanguageIdForResource("/some/path/Dockerfile")).toBe("dockerfile");
        expect(registry.getLanguageIdForResource("/some/path/dockerfile")).toBeUndefined();
    });

    it("matches по filenamePatterns (glob)", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt("ts", [
            { id: "jsonc", filenamePatterns: ["tsconfig.*.json"] },
        ]));

        expect(registry.getLanguageIdForResource("/p/tsconfig.build.json")).toBe("jsonc");
        expect(registry.getLanguageIdForResource("/p/tsconfig.json")).toBeUndefined();
    });

    it("matches по extension case-insensitive", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt("ts", [{ id: "typescript", extensions: [".ts"] }]));

        expect(registry.getLanguageIdForResource("file.ts")).toBe("typescript");
        expect(registry.getLanguageIdForResource("file.TS")).toBe("typescript");
    });

    it("приоритет filenames > filenamePatterns > extensions", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt("a", [{ id: "byext", extensions: [".json"] }]));
        registry.register(makeExt("b", [{ id: "bypattern", filenamePatterns: ["*.json"] }]));
        registry.register(makeExt("c", [{ id: "byname", filenames: ["package.json"] }]));

        expect(registry.getLanguageIdForResource("/p/package.json")).toBe("byname");
        expect(registry.getLanguageIdForResource("/p/foo.json")).toBe("bypattern");
    });

    it("возвращает undefined для незнакомого файла", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt("ts", [{ id: "typescript", extensions: [".ts"] }]));

        expect(registry.getLanguageIdForResource("foo.unknown")).toBeUndefined();
        expect(registry.getLanguageIdForResource("Makefile")).toBeUndefined();
    });

    it("сливает данные нескольких contribute'ов одного языка", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt("ts-base", [{ id: "typescript", extensions: [".ts"] }]));
        registry.register(makeExt("ts-extra", [{ id: "typescript", extensions: [".cts", ".mts"] }]));

        const lang = registry.getLanguage("typescript");
        expect(lang?.extensions).toEqual([".ts", ".cts", ".mts"]);
    });

    it("dispose() удаляет contributions расширения", () => {
        const registry = new LanguageRegistry();
        const d = registry.register(makeExt("ts", [{ id: "typescript", extensions: [".ts"] }]));
        expect(registry.getLanguage("typescript")).toBeDefined();

        d.dispose();
        expect(registry.getLanguage("typescript")).toBeUndefined();
    });

    it("dispose() одного из двух contribute'ов оставляет язык, но без вклада первого", () => {
        const registry = new LanguageRegistry();
        const d1 = registry.register(makeExt("ts-base", [{ id: "typescript", extensions: [".ts"] }]));
        registry.register(makeExt("ts-extra", [{ id: "typescript", extensions: [".cts"] }]));

        d1.dispose();
        const lang = registry.getLanguage("typescript");
        expect(lang?.extensions).toEqual([".cts"]);
    });

    it("resolveить configurationPath относительно extension.location", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt(
            "ts",
            [{ id: "typescript", extensions: [".ts"], configuration: "./language-configuration.json" }],
            "/ext/typescript-basics",
        ));

        const lang = registry.getLanguage("typescript");
        expect(lang?.configurationPath).toBe("/ext/typescript-basics/language-configuration.json");
    });

    it("allLanguages() возвращает все зарегистрированные", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt("a", [
            { id: "typescript", extensions: [".ts"] },
            { id: "javascript", extensions: [".js"] },
        ]));

        const ids = registry.allLanguages().map((l) => l.id).sort();
        expect(ids).toEqual(["javascript", "typescript"]);
    });
});
