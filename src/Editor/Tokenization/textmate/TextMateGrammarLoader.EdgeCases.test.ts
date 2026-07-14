import { describe, expect, it } from "vitest";

import { createDevAssetAccess } from "../../../vs/base/node/assets/createDefaultAssetAccess.ts";
import type { IAssetAccess, IAssetEntry } from "../../../vs/base/common/assets/assets.ts";

import type { IGrammarRecord } from "./TextMateGrammarLoader.ts";
import { TextMateGrammarLoader } from "./TextMateGrammarLoader.ts";

// Real dev assets are used only to satisfy the `onig.wasm` read needed by the
// oniguruma engine; grammar `.tmLanguage.json` content is served from memory so
// each test controls the registry's scope/injection/include topology exactly.
const devAssets = createDevAssetAccess();

class MemoryGrammarAssets implements IAssetAccess {
    private readonly files: Record<string, string | undefined>;

    public constructor(files: Record<string, string>) {
        this.files = files;
    }

    public read(virtualPath: string): Promise<Uint8Array> {
        if (virtualPath === "onig.wasm") return devAssets.read(virtualPath);
        return Promise.reject(new Error(`unexpected binary asset: ${virtualPath}`));
    }

    public readText(virtualPath: string): Promise<string> {
        const content = this.files[virtualPath];
        if (content === undefined) return Promise.reject(new Error(`missing asset: ${virtualPath}`));
        return Promise.resolve(content);
    }

    public exists(virtualPath: string): Promise<boolean> {
        return Promise.resolve(virtualPath in this.files);
    }

    public listEntries(): Promise<IAssetEntry[]> {
        return Promise.reject(new Error("listEntries not supported in this fixture"));
    }
}

describe("TextMateGrammarLoader — injection registration", () => {
    it("appends to an existing host injection list when two grammars inject into the same host", async () => {
        const assets = new MemoryGrammarAssets({
            "host.json": JSON.stringify({
                scopeName: "source.host",
                patterns: [{ match: "\\w+", name: "word.host" }],
            }),
            "inja.json": JSON.stringify({
                scopeName: "inj.a",
                injectionSelector: "L:source.host",
                patterns: [{ match: "AAA", name: "marker.a" }],
            }),
            "injb.json": JSON.stringify({
                scopeName: "inj.b",
                injectionSelector: "L:source.host",
                patterns: [{ match: "BBB", name: "marker.b" }],
            }),
        });

        // inj.a creates the host's injection list (list === undefined branch);
        // inj.b finds it already present and appends (list !== undefined branch).
        const records: IGrammarRecord[] = [
            { scopeName: "source.host", path: "host.json" },
            { scopeName: "inj.a", path: "inja.json", injections: ["source.host"] },
            { scopeName: "inj.b", path: "injb.json", injections: ["source.host"] },
        ];
        const loader = new TextMateGrammarLoader(assets, records);

        const support = await loader.loadSupport("source.host");
        expect(support).not.toBeNull();

        const result = support!.tokenizeLine("AAA BBB ccc", support!.getInitialState());
        const scopes = result.tokens.tokens.flatMap((t) => t.scopes);
        // Both injected grammars must contribute their markers, proving both ended
        // up in the host's injection list.
        expect(scopes).toContain("marker.a");
        expect(scopes).toContain("marker.b");
        loader.dispose();
    });
});

describe("TextMateGrammarLoader — unregistered external include", () => {
    it("resolves an unregistered included scope to null without throwing", async () => {
        const assets = new MemoryGrammarAssets({
            "outer.json": JSON.stringify({
                scopeName: "source.outer",
                patterns: [{ include: "source.absent" }, { match: "\\w+", name: "word.outer" }],
            }),
        });
        const loader = new TextMateGrammarLoader(assets, [{ scopeName: "source.outer", path: "outer.json" }]);

        const support = await loader.loadSupport("source.outer");
        expect(support).not.toBeNull();

        // `source.absent` has no record, so loadRawGrammar returns null for it; the
        // tokenizer must skip the dangling include and still classify the word.
        const result = support!.tokenizeLine("hello", support!.getInitialState());
        const scopes = result.tokens.tokens.flatMap((t) => t.scopes);
        expect(scopes).toContain("word.outer");
        loader.dispose();
    });
});
