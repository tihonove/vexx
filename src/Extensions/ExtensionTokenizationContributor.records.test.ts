import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IAssetAccess } from "../Common/Assets/IAssetAccess.ts";
import { NULL_STATE } from "../Editor/Tokenization/IState.ts";
import type { ITokenizationSupport } from "../Editor/Tokenization/ITokenizationSupport.ts";
import type { IGrammarRecord } from "../Editor/Tokenization/textmate/TextMateGrammarLoader.ts";
import { TextMateGrammarLoader } from "../Editor/Tokenization/textmate/TextMateGrammarLoader.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";

import type { IGrammarContribution } from "./IGrammarContribution.ts";
import type { IExtension } from "./IExtension.ts";
import { ExtensionTokenizationContributor } from "./ExtensionTokenizationContributor.ts";

// Mock the grammar loader so we can inspect exactly which IGrammarRecord[] the
// contributor collects (constructor arg) without touching real grammar assets.
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

function makeExt(id: string, location: string, grammars?: readonly IGrammarContribution[]): IExtension {
    return {
        id,
        location,
        isBuiltin: true,
        manifest: {
            name: id,
            publisher: "vscode",
            version: "1.0.0",
            engines: { vscode: "*" },
            ...(grammars === undefined ? {} : { contributes: { grammars } }),
        },
    } as IExtension;
}

/** Reads back the records[] passed to the (single) TextMateGrammarLoader call. */
function collectedRecords(): readonly IGrammarRecord[] {
    expect(MockedLoader).toHaveBeenCalledTimes(1);
    return MockedLoader.mock.calls[0][1];
}

const dummyAssets = {} as IAssetAccess;

describe("ExtensionTokenizationContributor — record collection", () => {
    beforeEach(() => MockedLoader.mockClear());

    it("returns early (no loader) when an extension declares an empty grammars array", async () => {
        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(dummyAssets, [makeExt("a", "Extensions/a/", [])], registry);

        await contributor.apply();

        expect(MockedLoader).not.toHaveBeenCalled();
        expect(() => contributor.dispose()).not.toThrow();
    });

    it("skips extensions whose manifest has no `contributes` block at all", async () => {
        MockedLoader.mockImplementationOnce(function () {
            return { loadSupport: vi.fn().mockResolvedValue(makeStubSupport()), dispose: vi.fn() } as never;
        });

        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(
            dummyAssets,
            // First ext: contributes undefined entirely (grammars === undefined branch).
            // Second ext: one real grammar.
            [
                makeExt("no-contributes", "Extensions/none/", undefined),
                makeExt("ts", "Extensions/ts/", [{ language: "typescript", scopeName: "source.ts", path: "./ts.json" }]),
            ],
            registry,
        );

        await contributor.apply();

        const records = collectedRecords();
        expect(records).toHaveLength(1);
        expect(records[0].scopeName).toBe("source.ts");
        contributor.dispose();
    });

    it("joins each grammar path against its extension location via joinVirtualPath", async () => {
        MockedLoader.mockImplementationOnce(function () {
            return { loadSupport: vi.fn().mockResolvedValue(makeStubSupport()), dispose: vi.fn() } as never;
        });

        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(
            dummyAssets,
            [makeExt("ts", "Extensions/builtin/ts/", [{ language: "typescript", scopeName: "source.ts", path: "./syntaxes/ts.tmLanguage.json" }])],
            registry,
        );

        await contributor.apply();

        const records = collectedRecords();
        expect(records[0].path).toBe("Extensions/builtin/ts/syntaxes/ts.tmLanguage.json");
    });

    it("carries injectTo through to the record's `injections` field", async () => {
        MockedLoader.mockImplementationOnce(function () {
            return { loadSupport: vi.fn().mockResolvedValue(makeStubSupport()), dispose: vi.fn() } as never;
        });

        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(
            dummyAssets,
            [
                makeExt("todo", "Extensions/todo/", [
                    { scopeName: "todo.injection", path: "./todo.json", injectTo: ["source.ts", "source.js"] },
                ]),
            ],
            registry,
        );

        await contributor.apply();

        const records = collectedRecords();
        expect(records[0].injections).toEqual(["source.ts", "source.js"]);
    });

    it("leaves `injections` undefined when a grammar has no injectTo", async () => {
        MockedLoader.mockImplementationOnce(function () {
            return { loadSupport: vi.fn().mockResolvedValue(makeStubSupport()), dispose: vi.fn() } as never;
        });

        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(
            dummyAssets,
            [makeExt("ts", "Extensions/ts/", [{ language: "typescript", scopeName: "source.ts", path: "./ts.json" }])],
            registry,
        );

        await contributor.apply();

        expect(collectedRecords()[0].injections).toBeUndefined();
        contributor.dispose();
    });

    it("collects every grammar across multiple extensions, preserving order", async () => {
        MockedLoader.mockImplementationOnce(function () {
            return { loadSupport: vi.fn().mockResolvedValue(makeStubSupport()), dispose: vi.fn() } as never;
        });

        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(
            dummyAssets,
            [
                makeExt("multi", "Extensions/multi/", [
                    { language: "typescript", scopeName: "source.ts", path: "./ts.json" },
                    { language: "typescriptreact", scopeName: "source.tsx", path: "./tsx.json" },
                ]),
                makeExt("css", "Extensions/css/", [{ language: "css", scopeName: "source.css", path: "./css.json" }]),
            ],
            registry,
        );

        await contributor.apply();

        const scopes = collectedRecords().map((r) => r.scopeName);
        expect(scopes).toEqual(["source.ts", "source.tsx", "source.css"]);
        contributor.dispose();
    });

    it("collects an injection-only grammar into records but does not register it (no `language`)", async () => {
        const support = makeStubSupport();
        MockedLoader.mockImplementationOnce(function () {
            return { loadSupport: vi.fn().mockResolvedValue(support), dispose: vi.fn() } as never;
        });

        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(
            dummyAssets,
            [
                makeExt("mix", "Extensions/mix/", [
                    { scopeName: "todo.injection", path: "./todo.json", injectTo: ["source.ts"] },
                    { language: "typescript", scopeName: "source.ts", path: "./ts.json" },
                ]),
            ],
            registry,
        );

        await contributor.apply();

        // Both grammars reach the loader...
        expect(collectedRecords().map((r) => r.scopeName)).toEqual(["todo.injection", "source.ts"]);
        // ...but only the one with a `language` is registered.
        expect(registry.get("typescript")).toBe(support);
        contributor.dispose();
    });
});
