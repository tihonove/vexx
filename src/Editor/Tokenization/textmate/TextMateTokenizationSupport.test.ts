import { describe, expect, it } from "vitest";

import { BUILTIN_GRAMMAR_RECORDS, BUILTIN_LANGUAGES } from "./builtinGrammars.ts";
import { TextMateGrammarLoader } from "./TextMateGrammarLoader.ts";
import { TextMateState } from "./TextMateState.ts";

describe("TextMateTokenizationSupport", () => {
    it("getInitialState() возвращает обёртку TextMateState над INITIAL", async () => {
        const loader = new TextMateGrammarLoader(BUILTIN_GRAMMAR_RECORDS);
        const support = await loader.loadSupport("source.js");
        if (!support) throw new Error("source.js not loaded");

        const state = support.getInitialState();
        expect(state).toBeInstanceOf(TextMateState);
        expect(state.equals(state)).toBe(true);
    });

    it("конвертирует вывод vscode-textmate в наш ILineTokens", async () => {
        const loader = new TextMateGrammarLoader(BUILTIN_GRAMMAR_RECORDS);
        const support = await loader.loadSupport("source.js");
        if (!support) throw new Error("source.js not loaded");

        const result = support.tokenizeLine("const x = 1;", support.getInitialState());
        const tokens = result.tokens.tokens;

        expect(tokens.length).toBeGreaterThan(0);
        expect(tokens[0].startIndex).toBe(0);
        expect(tokens[0].scopes[0]).toBe("source.js");
    });

    it("`const` получает scope `storage.type.js`", async () => {
        const loader = new TextMateGrammarLoader(BUILTIN_GRAMMAR_RECORDS);
        const support = await loader.loadSupport("source.js");
        if (!support) throw new Error("source.js not loaded");

        const line = "const x = 1;";
        const result = support.tokenizeLine(line, support.getInitialState());
        const constTok = result.tokens.tokens.find((t) => t.startIndex === 0);
        expect(constTok?.scopes).toContain("storage.type.js");
    });

    it("endState между строками внутри блока комментария стабилизируется (equals=true)", async () => {
        const loader = new TextMateGrammarLoader(BUILTIN_GRAMMAR_RECORDS);
        const support = await loader.loadSupport("source.js");
        if (!support) throw new Error("source.js not loaded");

        const r1 = support.tokenizeLine("/* line1", support.getInitialState());
        const r2 = support.tokenizeLine("line2", r1.endState);
        const r3 = support.tokenizeLine("line3", r2.endState);

        expect(r1.endState.equals(r2.endState)).toBe(true);
        expect(r2.endState.equals(r3.endState)).toBe(true);
    });

    it("на сверхдлинной строке возвращает один root-scope токен и тот же endState", async () => {
        const loader = new TextMateGrammarLoader(BUILTIN_GRAMMAR_RECORDS);
        const support = await loader.loadSupport("source.js");
        if (!support) throw new Error("source.js not loaded");

        const line = "x".repeat(20_001);
        const initial = support.getInitialState();
        const result = support.tokenizeLine(line, initial);

        expect(result.tokens.tokens).toEqual([{ startIndex: 0, scopes: ["source.js"] }]);
        expect(result.endState).toBe(initial);
    });

    it("loader.loadSupport для неизвестного scope возвращает null", async () => {
        const loader = new TextMateGrammarLoader(BUILTIN_GRAMMAR_RECORDS);
        const support = await loader.loadSupport("source.unknown");
        expect(support).toBeNull();
    });

    it("все BUILTIN_LANGUAGES грузятся успешно", async () => {
        const loader = new TextMateGrammarLoader(BUILTIN_GRAMMAR_RECORDS);
        for (const lang of BUILTIN_LANGUAGES) {
            const support = await loader.loadSupport(lang.scopeName);
            expect(support, `${lang.languageId} (${lang.scopeName}) must load`).not.toBeNull();
        }
    });
});
