import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { scanBuiltinExtensions } from "../../../Extensions/ExtensionScanner.ts";
import type { IExtension } from "../../../Extensions/IExtension.ts";

import type { IGrammarRecord } from "./TextMateGrammarLoader.ts";
import { TextMateGrammarLoader } from "./TextMateGrammarLoader.ts";
import { TextMateState } from "./TextMateState.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const builtinDir = path.resolve(here, "..", "..", "..", "Extensions", "builtin");

function collectGrammarRecords(extensions: readonly IExtension[]): IGrammarRecord[] {
    const records: IGrammarRecord[] = [];
    for (const ext of extensions) {
        const grammars = ext.manifest.contributes?.grammars;
        if (grammars === undefined) continue;
        for (const grammar of grammars) {
            records.push({
                scopeName: grammar.scopeName,
                path: path.resolve(ext.location, grammar.path),
                injections: grammar.injectTo,
            });
        }
    }
    return records;
}

const extensionsPromise = scanBuiltinExtensions(builtinDir);
const recordsPromise = extensionsPromise.then(collectGrammarRecords);

async function createLoader(): Promise<TextMateGrammarLoader> {
    return new TextMateGrammarLoader(await recordsPromise);
}

describe("TextMateTokenizationSupport", () => {
    it("getInitialState() возвращает обёртку TextMateState над INITIAL", async () => {
        const loader = await createLoader();
        const support = await loader.loadSupport("source.js");
        if (!support) throw new Error("source.js not loaded");

        const state = support.getInitialState();
        expect(state).toBeInstanceOf(TextMateState);
        expect(state.equals(state)).toBe(true);
    });

    it("конвертирует вывод vscode-textmate в наш ILineTokens", async () => {
        const loader = await createLoader();
        const support = await loader.loadSupport("source.js");
        if (!support) throw new Error("source.js not loaded");

        const result = support.tokenizeLine("const x = 1;", support.getInitialState());
        const tokens = result.tokens.tokens;

        expect(tokens.length).toBeGreaterThan(0);
        expect(tokens[0].startIndex).toBe(0);
        expect(tokens[0].scopes[0]).toBe("source.js");
    });

    it("`const` получает scope `storage.type.js`", async () => {
        const loader = await createLoader();
        const support = await loader.loadSupport("source.js");
        if (!support) throw new Error("source.js not loaded");

        const line = "const x = 1;";
        const result = support.tokenizeLine(line, support.getInitialState());
        const constTok = result.tokens.tokens.find((t) => t.startIndex === 0);
        expect(constTok?.scopes).toContain("storage.type.js");
    });

    it("endState между строками внутри блока комментария стабилизируется (equals=true)", async () => {
        const loader = await createLoader();
        const support = await loader.loadSupport("source.js");
        if (!support) throw new Error("source.js not loaded");

        const r1 = support.tokenizeLine("/* line1", support.getInitialState());
        const r2 = support.tokenizeLine("line2", r1.endState);
        const r3 = support.tokenizeLine("line3", r2.endState);

        expect(r1.endState.equals(r2.endState)).toBe(true);
        expect(r2.endState.equals(r3.endState)).toBe(true);
    });

    it("на сверхдлинной строке возвращает один root-scope токен и тот же endState", async () => {
        const loader = await createLoader();
        const support = await loader.loadSupport("source.js");
        if (!support) throw new Error("source.js not loaded");

        const line = "x".repeat(20_001);
        const initial = support.getInitialState();
        const result = support.tokenizeLine(line, initial);

        expect(result.tokens.tokens).toEqual([{ startIndex: 0, scopes: ["source.js"] }]);
        expect(result.endState).toBe(initial);
    });

    it("loader.loadSupport для неизвестного scope возвращает null", async () => {
        const loader = await createLoader();
        const support = await loader.loadSupport("source.unknown");
        expect(support).toBeNull();
    });

    it("все builtin-грамматики с language грузятся успешно", async () => {
        const loader = await createLoader();
        const extensions = await extensionsPromise;
        for (const ext of extensions) {
            const grammars = ext.manifest.contributes?.grammars ?? [];
            for (const grammar of grammars) {
                if (grammar.language === undefined) continue;
                const support = await loader.loadSupport(grammar.scopeName);
                expect(support, `${grammar.language} (${grammar.scopeName}) must load`).not.toBeNull();
            }
        }
    });
});
