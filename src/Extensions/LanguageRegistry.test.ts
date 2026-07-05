import { describe, expect, it } from "vitest";

import type { IExtension } from "./IExtension.ts";
import { LanguageRegistry } from "./LanguageRegistry.ts";

function makeExt(id: string, languages: object[], location = "Extensions/builtin/test/"): IExtension {
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
        registry.register(makeExt("ts", [{ id: "jsonc", filenamePatterns: ["tsconfig.*.json"] }]));

        expect(registry.getLanguageIdForResource("/p/tsconfig.build.json")).toBe("jsonc");
        expect(registry.getLanguageIdForResource("/p/tsconfig.json")).toBeUndefined();
    });

    it("escapes regex-special characters in filenamePatterns (literal '+' match)", () => {
        const registry = new LanguageRegistry();
        // '+' is a regex quantifier; it must be matched literally, not as "one or more".
        registry.register(makeExt("p", [{ id: "plusfile", filenamePatterns: ["c++.*"] }]));

        expect(registry.getLanguageIdForResource("/p/c++.zzz")).toBe("plusfile");
        // 'cc.zzz' would match if '+' were treated as a quantifier — it must NOT.
        expect(registry.getLanguageIdForResource("/p/cc.zzz")).toBeUndefined();
    });

    it("records firstLine from a language contribution", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt("sh", [{ id: "shellscript", extensions: [".sh"], firstLine: "^#!.*\\bsh\\b" }]));

        expect(registry.getLanguage("shellscript")?.firstLine).toBe("^#!.*\\bsh\\b");
    });

    it("register() with empty languages list returns a no-op disposable", () => {
        const registry = new LanguageRegistry();
        const disposable = registry.register(makeExt("nolang", []));

        // No languages registered (кроме seed'а plaintext), и dispose no-op'а не бросает.
        expect(registry.allLanguages().map((l) => l.id)).toEqual(["plaintext"]);
        expect(() => {
            disposable.dispose();
        }).not.toThrow();
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
        registry.register(
            makeExt(
                "ts",
                [{ id: "typescript", extensions: [".ts"], configuration: "./language-configuration.json" }],
                "Extensions/builtin/typescript-basics/",
            ),
        );

        const lang = registry.getLanguage("typescript");
        expect(lang?.configurationPath).toBe("Extensions/builtin/typescript-basics/language-configuration.json");
    });

    it("matches filenamePatterns с одиночным wildcard '?'", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt("q", [{ id: "qlang", filenamePatterns: ["file?.zzz"] }]));

        // '?' матчит ровно один символ.
        expect(registry.getLanguageIdForResource("/p/fileA.zzz")).toBe("qlang");
        expect(registry.getLanguageIdForResource("/p/file1.zzz")).toBe("qlang");
        // Ноль или два символа в позиции '?' матчиться не должны.
        expect(registry.getLanguageIdForResource("/p/file.zzz")).toBeUndefined();
        expect(registry.getLanguageIdForResource("/p/fileAB.zzz")).toBeUndefined();
    });

    it("повторный dispose contribution'а — no-op (запись уже удалена)", () => {
        const registry = new LanguageRegistry();
        const d = registry.register(makeExt("ts", [{ id: "typescript", extensions: [".ts"] }]));

        d.dispose();
        expect(registry.getLanguage("typescript")).toBeUndefined();
        // Второй dispose не должен бросать: запись для языка уже удалена (delta<0, entry===undefined).
        expect(() => {
            d.dispose();
        }).not.toThrow();
        expect(registry.getLanguage("typescript")).toBeUndefined();
    });

    it("повторный dispose не удаляет строки, которых уже нет в записи", () => {
        const registry = new LanguageRegistry();
        // Два расширения держат язык живым разными extensions.
        const d1 = registry.register(makeExt("a", [{ id: "typescript", extensions: [".ts"] }]));
        registry.register(makeExt("b", [{ id: "typescript", extensions: [".js"] }]));

        d1.dispose(); // удаляет ".ts", остаётся [".js"]
        expect(registry.getLanguage("typescript")?.extensions).toEqual([".js"]);

        // Повторный dispose пытается снять уже отсутствующий ".ts" — indexOf вернёт -1, splice не вызывается.
        d1.dispose();
        expect(registry.getLanguage("typescript")?.extensions).toEqual([".js"]);
    });

    it("allLanguages() возвращает все зарегистрированные", () => {
        const registry = new LanguageRegistry();
        registry.register(
            makeExt("a", [
                { id: "typescript", extensions: [".ts"] },
                { id: "javascript", extensions: [".js"] },
            ]),
        );

        const ids = registry
            .allLanguages()
            .map((l) => l.id)
            .sort();
        expect(ids).toEqual(["javascript", "plaintext", "typescript"]);
    });

    it("seed'ит plaintext как core-язык", () => {
        const registry = new LanguageRegistry();

        expect(registry.getLanguage("plaintext")?.aliases).toEqual(["Plain Text"]);
        expect(registry.getLanguageIdForResource("notes.txt")).toBe("plaintext");
    });

    it("getLanguageDisplayName возвращает первый alias", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt("ts", [{ id: "typescript", extensions: [".ts"], aliases: ["TypeScript", "ts"] }]));

        expect(registry.getLanguageDisplayName("typescript")).toBe("TypeScript");
        expect(registry.getLanguageDisplayName("plaintext")).toBe("Plain Text");
    });

    it("getLanguageDisplayName — undefined для незнакомого языка и языка без alias'ов", () => {
        const registry = new LanguageRegistry();
        registry.register(makeExt("x", [{ id: "aliasless", extensions: [".x"] }]));

        expect(registry.getLanguageDisplayName("unknown")).toBeUndefined();
        expect(registry.getLanguageDisplayName("aliasless")).toBeUndefined();
    });

    // WP8: completion-провайдер editorconfig завязан на languageId "editorconfig".
    // Расширение вносит его через contributes.languages.filenames, что и должно
    // резолвить .editorconfig-файл в нужный язык (точное имя бьёт .extensions).
    it("резолвит .editorconfig в 'editorconfig' по contributes.languages user-расширения", () => {
        const registry = new LanguageRegistry();
        // Builtin ini кладёт .editorconfig в .extensions (не срабатывает: extname('.editorconfig') === '').
        registry.register(makeExt("ini", [{ id: "properties", extensions: [".editorconfig", ".ini"] }]));
        // Без editorconfig-расширения .editorconfig не резолвится.
        expect(registry.getLanguageIdForResource("/p/.editorconfig")).toBeUndefined();

        // User editorconfig-расширение вносит точное filenames-соответствие.
        registry.register(
            makeExt(
                "editorconfig",
                [{ id: "editorconfig", filenames: [".editorconfig"], aliases: ["EditorConfig"] }],
                "UserExtensions/EditorConfig.EditorConfig-0.16.0/",
            ),
        );
        expect(registry.getLanguageIdForResource("/p/.editorconfig")).toBe("editorconfig");
        expect(registry.getLanguageIdForResource(".editorconfig")).toBe("editorconfig");
    });
});
