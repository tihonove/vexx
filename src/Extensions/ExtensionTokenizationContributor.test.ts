import { describe, expect, it, vi } from "vitest";

import { createDevAssetAccess } from "../Common/Assets/createDefaultAssetAccess.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";

import { scanBuiltinExtensions } from "./ExtensionScanner.ts";
import { ExtensionTokenizationContributor } from "./ExtensionTokenizationContributor.ts";

const ROOT_PREFIX = "Extensions/builtin/";

describe("ExtensionTokenizationContributor", () => {
    it("регистрирует tokenization support для всех языков из builtin-расширений", async () => {
        const assets = createDevAssetAccess();
        const exts = await scanBuiltinExtensions(assets, ROOT_PREFIX);
        expect(exts.length).toBeGreaterThan(0);

        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(assets, exts, registry);
        contributor.apply();

        for (const lang of ["javascript", "javascriptreact", "typescript", "typescriptreact", "css"]) {
            expect(await registry.load(lang), `${lang} must be loadable`).toBeDefined();
        }
        contributor.dispose();
    });

    it("loaded TypeScript support tokenizes 'const x = 1;' с scope storage.type.ts", async () => {
        const assets = createDevAssetAccess();
        const exts = await scanBuiltinExtensions(assets, ROOT_PREFIX);
        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(assets, exts, registry);
        contributor.apply();

        const ts = await registry.load("typescript");
        expect(ts).toBeDefined();
        const result = ts!.tokenizeLine("const x = 1;", ts!.getInitialState());
        const constTok = result.tokens.tokens.find((t) => t.startIndex === 0);
        expect(constTok?.scopes).toContain("storage.type.ts");

        contributor.dispose();
    });

    it("dispose() убирает регистрации из TokenizationRegistry", async () => {
        const assets = createDevAssetAccess();
        const exts = await scanBuiltinExtensions(assets, ROOT_PREFIX);
        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(assets, exts, registry);
        contributor.apply();
        expect(await registry.load("typescript")).toBeDefined();
        expect(registry.get("typescript")).toBeDefined();

        contributor.dispose();
        expect(registry.get("typescript")).toBeUndefined();
    });

    // Регрессионный замок на eager-парсинг: 77 builtin-грамматик — это 6.6 MB
    // JSON, и открытие одного .ts не должно их трогать.
    it("apply() не читает ассеты — грамматика парсится только на load()", async () => {
        const assets = createDevAssetAccess();
        const exts = await scanBuiltinExtensions(assets, ROOT_PREFIX);
        const registry = new TokenizationRegistry();
        const readText = vi.spyOn(assets, "readText");
        const contributor = new ExtensionTokenizationContributor(assets, exts, registry);

        contributor.apply();
        expect(readText).not.toHaveBeenCalled();

        await registry.load("typescript");
        expect(readText).toHaveBeenCalled();
        // Грузим только запрошенный язык, а не весь builtin-набор.
        expect(registry.get("css")).toBeUndefined();

        contributor.dispose();
        readText.mockRestore();
    });

    it("preloadAll() прогревает остальные языки", async () => {
        const assets = createDevAssetAccess();
        const exts = await scanBuiltinExtensions(assets, ROOT_PREFIX);
        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(assets, exts, registry);
        contributor.apply();

        await registry.load("typescript");
        expect(registry.get("css")).toBeUndefined();

        await contributor.preloadAll();
        expect(registry.get("css")).toBeDefined();
        expect(registry.get("javascript")).toBeDefined();

        contributor.dispose();
    });

    it("dispose() до load() — фабрика ничего не регистрирует", async () => {
        const assets = createDevAssetAccess();
        const exts = await scanBuiltinExtensions(assets, ROOT_PREFIX);
        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(assets, exts, registry);
        contributor.apply();
        contributor.dispose();

        expect(await registry.load("typescript")).toBeUndefined();
        expect(registry.get("typescript")).toBeUndefined();
    });
});
