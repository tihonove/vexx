import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";

import { scanBuiltinExtensions } from "./ExtensionScanner.ts";
import { ExtensionTokenizationContributor } from "./ExtensionTokenizationContributor.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const builtinDir = path.resolve(here, "builtin");

describe("ExtensionTokenizationContributor", () => {
    it("регистрирует tokenization support для всех языков из builtin-расширений", async () => {
        const exts = await scanBuiltinExtensions(builtinDir);
        expect(exts.length).toBeGreaterThan(0);

        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(exts, registry);
        await contributor.apply();

        for (const lang of ["javascript", "javascriptreact", "typescript", "typescriptreact", "css"]) {
            expect(registry.get(lang), `${lang} must be registered`).toBeDefined();
        }
        contributor.dispose();
    });

    it("loaded TypeScript support tokenizes 'const x = 1;' с scope storage.type.ts", async () => {
        const exts = await scanBuiltinExtensions(builtinDir);
        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(exts, registry);
        await contributor.apply();

        const ts = registry.get("typescript");
        expect(ts).toBeDefined();
        const result = ts!.tokenizeLine("const x = 1;", ts!.getInitialState());
        const constTok = result.tokens.tokens.find((t) => t.startIndex === 0);
        expect(constTok?.scopes).toContain("storage.type.ts");

        contributor.dispose();
    });

    it("dispose() убирает регистрации из TokenizationRegistry", async () => {
        const exts = await scanBuiltinExtensions(builtinDir);
        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(exts, registry);
        await contributor.apply();
        expect(registry.get("typescript")).toBeDefined();

        contributor.dispose();
        expect(registry.get("typescript")).toBeUndefined();
    });
});
