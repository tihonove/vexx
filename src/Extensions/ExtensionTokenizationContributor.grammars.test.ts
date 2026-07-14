import { describe, expect, it, vi } from "vitest";

import type { IAssetAccess } from "../vs/base/common/assets/assets.ts";
import { NULL_STATE } from "../vs/editor/common/languages/state.ts";
import type { ITokenizationSupport } from "../vs/editor/common/languages/tokenizationSupport.ts";
import { TextMateGrammarLoader } from "../Editor/Tokenization/textmate/TextMateGrammarLoader.ts";
import { TokenizationRegistry } from "../vs/editor/common/tokenizationRegistry.ts";

import { ExtensionTokenizationContributor } from "./ExtensionTokenizationContributor.ts";
import type { IExtension } from "../vs/platform/extensions/common/extensions.ts";

// Mock the grammar loader so we can drive loadSupport() without touching real grammar assets.
vi.mock("../Editor/Tokenization/textmate/TextMateGrammarLoader.ts", () => {
    return {
        TextMateGrammarLoader: vi.fn().mockImplementation(function () {
            return { loadSupport: vi.fn(), dispose: vi.fn() };
        }),
    };
});

const MockedLoader = vi.mocked(TextMateGrammarLoader);

function makeStubSupport(): ITokenizationSupport {
    return {
        getInitialState: () => NULL_STATE,
        tokenizeLine: () => ({ tokens: { tokens: [] }, endState: NULL_STATE }),
    };
}

function makeExtWithGrammar(): IExtension {
    return {
        id: "vscode.typescript",
        location: "Extensions/builtin/ts/",
        isBuiltin: true,
        manifest: {
            name: "typescript",
            publisher: "vscode",
            version: "1.0.0",
            engines: { vscode: "*" },
            contributes: {
                grammars: [{ language: "typescript", scopeName: "source.ts", path: "./syntaxes/ts.tmLanguage.json" }],
            },
        },
    } as IExtension;
}

/** Extension that contributes no grammars at all (no `contributes.grammars`). */
function makeExtWithoutGrammar(): IExtension {
    return {
        id: "vscode.theme-only",
        location: "Extensions/builtin/theme/",
        isBuiltin: true,
        manifest: {
            name: "theme-only",
            publisher: "vscode",
            version: "1.0.0",
            engines: { vscode: "*" },
            contributes: {},
        },
    } as IExtension;
}

const dummyAssets = {} as IAssetAccess;

describe("ExtensionTokenizationContributor — grammar collection", () => {
    it("returns early and never creates a loader when no extension contributes grammars", async () => {
        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(
            dummyAssets,
            [makeExtWithoutGrammar(), makeExtWithoutGrammar()],
            registry,
        );

        await contributor.apply();

        expect(MockedLoader).not.toHaveBeenCalled();
        // dispose() with no loader and no registrations must be safe.
        expect(() => {
            contributor.dispose();
        }).not.toThrow();
    });

    it("skips extensions without grammars and registers only the contributing ones", async () => {
        const support = makeStubSupport();
        MockedLoader.mockImplementationOnce(function () {
            return { loadSupport: vi.fn().mockResolvedValue(support), dispose: vi.fn() } as never;
        });

        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(
            dummyAssets,
            // Mix: one extension with grammars, one without — the latter must be ignored.
            [makeExtWithoutGrammar(), makeExtWithGrammar()],
            registry,
        );

        await contributor.apply();

        expect(MockedLoader).toHaveBeenCalledTimes(1);
        // Only one grammar record was collected (from the contributing extension).
        const records = MockedLoader.mock.calls[0][1];
        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({ scopeName: "source.ts" });

        expect(registry.get("typescript")).toBe(support);

        contributor.dispose();
    });
});
