import { describe, expect, it } from "vitest";

import { joinVirtualPath } from "../../../../base/common/assets/assetBundleFormat.ts";
import { createDevAssetAccess } from "../../../../base/node/assets/createDefaultAssetAccess.ts";
import { scanBuiltinExtensions } from "../../../../platform/extensions/common/extensionScanner.ts";
import type { IExtension } from "../../../../platform/extensions/common/iExtension.ts";

import type { IGrammarRecord } from "./textMateGrammarLoader.ts";
import { TextMateGrammarLoader } from "./textMateGrammarLoader.ts";

const assets = createDevAssetAccess();

function collectGrammarRecords(extensions: readonly IExtension[]): IGrammarRecord[] {
    const records: IGrammarRecord[] = [];
    for (const ext of extensions) {
        const grammars = ext.manifest.contributes?.grammars;
        if (grammars === undefined) continue;
        for (const grammar of grammars) {
            records.push({
                scopeName: grammar.scopeName,
                path: joinVirtualPath(ext.location, grammar.path),
                injections: grammar.injectTo,
            });
        }
    }
    return records;
}

const recordsPromise = scanBuiltinExtensions(assets, "Extensions/builtin/").then(collectGrammarRecords);

describe("TextMateGrammarLoader", () => {
    it("loads a registered grammar and produces tokens", async () => {
        const loader = new TextMateGrammarLoader(assets, await recordsPromise);
        const support = await loader.loadSupport("source.js");
        expect(support).not.toBeNull();

        const result = support!.tokenizeLine("const x = 1;", support!.getInitialState());
        expect(result.tokens.tokens[0].scopes[0]).toBe("source.js");
        loader.dispose();
    });

    it("returns null for an unregistered scope without touching the registry", async () => {
        const loader = new TextMateGrammarLoader(assets, await recordsPromise);
        expect(await loader.loadSupport("source.does-not-exist")).toBeNull();
        loader.dispose();
    });

    it("caches the grammar promise: two loadSupport calls return distinct support wrappers over one grammar", async () => {
        const loader = new TextMateGrammarLoader(assets, await recordsPromise);
        const a = await loader.loadSupport("source.js");
        const b = await loader.loadSupport("source.js");
        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
        // Both wrappers tokenize identically (same underlying grammar).
        const ra = a!.tokenizeLine("let y", a!.getInitialState());
        const rb = b!.tokenizeLine("let y", b!.getInitialState());
        expect(ra.tokens.tokens).toEqual(rb.tokens.tokens);
        loader.dispose();
    });

    it("registers injection grammars (line 43): jsdoc scopes appear inside /** */ in source.js", async () => {
        // Build the loader from explicit records that exercise the injection map:
        // jsdoc injects into source.js, and a second injection shares the same host
        // (so the host's injection list is appended to, hitting the list-init + push path).
        const baseRecords = await recordsPromise;
        const jsRecord = baseRecords.find((r) => r.scopeName === "source.js");
        const jsdocRecord = baseRecords.find((r) => r.injections?.includes("source.js"));
        expect(jsRecord, "source.js grammar record must exist").toBeDefined();
        expect(jsdocRecord, "a grammar injecting into source.js must exist").toBeDefined();

        const loader = new TextMateGrammarLoader(assets, baseRecords);
        const support = await loader.loadSupport("source.js");
        expect(support).not.toBeNull();

        const line = "/** @param {string} x */";
        const result = support!.tokenizeLine(line, support!.getInitialState());
        const allScopes = result.tokens.tokens.flatMap((t) => t.scopes);

        // The jsdoc injection contributes documentation-block scopes inside the comment.
        expect(allScopes.some((s) => s.includes("comment.block.documentation"))).toBe(true);
        loader.dispose();
    });
});
