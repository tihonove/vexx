import { describe, expect, it, vi } from "vitest";

import type { IAssetAccess } from "../vs/base/common/assets/assets.ts";
import type { ILogger } from "../vs/platform/log/common/logger.ts";
import { TextMateGrammarLoader } from "../Editor/Tokenization/textmate/TextMateGrammarLoader.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";

import { ExtensionTokenizationContributor } from "./ExtensionTokenizationContributor.ts";
import type { IExtension } from "../vs/platform/extensions/common/extensions.ts";

// Mock the grammar loader so we can drive loadSupport() into the null / throw branches
// without touching real grammar assets.
vi.mock("../Editor/Tokenization/textmate/TextMateGrammarLoader.ts", () => {
    return {
        TextMateGrammarLoader: vi.fn().mockImplementation(function () {
            return { loadSupport: vi.fn(), dispose: vi.fn() };
        }),
    };
});

const MockedLoader = vi.mocked(TextMateGrammarLoader);

function createLoggerSpy(): ILogger & { error: ReturnType<typeof vi.fn> } {
    return {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        isEnabled: () => true,
    } as unknown as ILogger & { error: ReturnType<typeof vi.fn> };
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

const dummyAssets = {} as IAssetAccess;

describe("ExtensionTokenizationContributor — error handling", () => {
    it("logs an error and registers nothing when loadSupport() returns null", async () => {
        MockedLoader.mockImplementationOnce(function () {
            return { loadSupport: vi.fn().mockResolvedValue(null), dispose: vi.fn() } as never;
        });

        const logger = createLoggerSpy();
        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(dummyAssets, [makeExtWithGrammar()], registry, logger);

        await contributor.apply();

        expect(registry.get("typescript")).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Failed to load grammar "source.ts" for language "typescript"'),
        );
    });

    it("logs an error when loadSupport() throws", async () => {
        const boom = new Error("grammar parse error");
        MockedLoader.mockImplementationOnce(function () {
            return { loadSupport: vi.fn().mockRejectedValue(boom), dispose: vi.fn() } as never;
        });

        const logger = createLoggerSpy();
        const registry = new TokenizationRegistry();
        const contributor = new ExtensionTokenizationContributor(dummyAssets, [makeExtWithGrammar()], registry, logger);

        await contributor.apply();

        expect(registry.get("typescript")).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error loading grammar "source.ts" (typescript)'),
            boom,
        );
    });
});
