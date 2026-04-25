import { describe, expect, it } from "vitest";

import { PlainTextTokenizer } from "./builtin/PlainTextTokenizer.ts";
import { NULL_STATE } from "./IState.ts";
import type { ITokenizationSupport } from "./ITokenizationSupport.ts";
import { TokenizationRegistry } from "./TokenizationRegistry.ts";

function makeStubSupport(): ITokenizationSupport {
    return {
        getInitialState: () => NULL_STATE,
        tokenizeLine: () => ({ tokens: { tokens: [] }, endState: NULL_STATE }),
    };
}

describe("TokenizationRegistry", () => {
    it("returns undefined for unknown languageId", () => {
        const reg = new TokenizationRegistry();
        expect(reg.get("nonexistent")).toBeUndefined();
    });

    it("registers and retrieves a tokenizer", () => {
        const reg = new TokenizationRegistry();
        const support = new PlainTextTokenizer();
        reg.register("plaintext", support);
        expect(reg.get("plaintext")).toBe(support);
    });

    it("overwrites an existing registration", () => {
        const reg = new TokenizationRegistry();
        const a = makeStubSupport();
        const b = makeStubSupport();
        reg.register("javascript", a);
        reg.register("javascript", b);
        expect(reg.get("javascript")).toBe(b);
    });

    it("dispose() returned from register() unregisters", () => {
        const reg = new TokenizationRegistry();
        const support = new PlainTextTokenizer();
        const handle = reg.register("plaintext", support);
        handle.dispose();
        expect(reg.get("plaintext")).toBeUndefined();
    });

    it("fires onDidChange when a tokenizer is registered", () => {
        const reg = new TokenizationRegistry();
        const seen: string[] = [];
        reg.onDidChange((langId) => seen.push(langId));
        reg.register("javascript", makeStubSupport());
        reg.register("typescript", makeStubSupport());
        expect(seen).toEqual(["javascript", "typescript"]);
    });
});
