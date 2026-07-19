import { describe, expect, it } from "vitest";

import { WordTokenizer } from "./wordTokenizer.ts";

function tokenize(src: string): { startIndex: number; scopes: readonly string[] }[] {
    const t = new WordTokenizer();
    const result = t.tokenizeLine(src, t.getInitialState());
    return result.tokens.tokens.map((tok) => ({ startIndex: tok.startIndex, scopes: tok.scopes }));
}

function lastScope(scopes: readonly string[]): string {
    return scopes[scopes.length - 1] ?? "";
}

describe("WordTokenizer", () => {
    it("emits a single empty-scope token for an empty line", () => {
        const tokens = tokenize("");
        expect(tokens).toEqual([{ startIndex: 0, scopes: ["source"] }]);
    });

    it("classifies known JS keywords as keyword.control", () => {
        const tokens = tokenize("if return const");
        expect(lastScope(tokens[0].scopes)).toBe("keyword.control");
    });

    it("classifies identifiers separately from keywords", () => {
        const tokens = tokenize("foo");
        expect(lastScope(tokens[0].scopes)).toBe("identifier");
    });

    it("recognises numeric literals", () => {
        const tokens = tokenize("123");
        expect(lastScope(tokens[0].scopes)).toBe("constant.numeric");
    });

    it("recognises double-quoted strings", () => {
        const tokens = tokenize('"hello"');
        expect(lastScope(tokens[0].scopes)).toBe("string.quoted");
    });

    it("recognises single-quoted strings", () => {
        const tokens = tokenize("'hi'");
        expect(lastScope(tokens[0].scopes)).toBe("string.quoted");
    });

    it("treats `// ...` as a comment to end of line", () => {
        const tokens = tokenize("x // comment");
        const commentToken = tokens.find((t) => lastScope(t.scopes) === "comment.line");
        expect(commentToken).toBeDefined();
        expect(commentToken!.startIndex).toBe(2);
    });

    it("emits tokens with strictly increasing startIndex", () => {
        const tokens = tokenize("if (x === 1) return null");
        for (let i = 1; i < tokens.length; i++) {
            expect(tokens[i].startIndex).toBeGreaterThan(tokens[i - 1].startIndex);
        }
    });

    it("first token always starts at index 0", () => {
        const tokens = tokenize("   leading whitespace");
        expect(tokens[0].startIndex).toBe(0);
    });

    it("treats an escaped quote inside a string as part of the string token", () => {
        // The backslash escapes the inner quote, so the string does not terminate
        // until the final quote — the whole literal is one string.quoted token.
        const tokens = tokenize('"a\\"b" x');
        expect(lastScope(tokens[0].scopes)).toBe("string.quoted");

        // The identifier `x` only appears after the string closes; if the escape
        // were mishandled the string would have ended early and `x` would shift.
        const ident = tokens.find((t) => lastScope(t.scopes) === "identifier");
        expect(ident).toBeDefined();
        expect(ident!.startIndex).toBe(7);
    });

    it("skips an escaped backslash without ending the string early", () => {
        const tokens = tokenize("'a\\\\' 1");
        expect(lastScope(tokens[0].scopes)).toBe("string.quoted");

        const num = tokens.find((t) => lastScope(t.scopes) === "constant.numeric");
        expect(num).toBeDefined();
        expect(num!.startIndex).toBe(6);
    });

    it("treats digits inside an identifier as identifier parts, not numbers", () => {
        // The trailing/embedded digits are consumed by isIdentPart, so `foo2` and
        // `bar3baz` are single identifier tokens — no numeric token is emitted.
        const tokens = tokenize("foo2 bar3baz");
        expect(tokens[0]).toEqual({ startIndex: 0, scopes: ["source", "identifier"] });
        const ident = tokens.find((t) => t.startIndex === 5);
        expect(ident).toBeDefined();
        expect(lastScope(ident!.scopes)).toBe("identifier");
        expect(tokens.some((t) => lastScope(t.scopes) === "constant.numeric")).toBe(false);
    });
});
