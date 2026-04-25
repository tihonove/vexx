import { describe, expect, it } from "vitest";

import type { IEditorTokenTheme } from "../IEditorTokenTheme.ts";

import { TokenThemeResolver } from "./TokenThemeResolver.ts";

const RED = 0xff0000;
const BLUE = 0x0000ff;
const GREEN = 0x00ff00;

function theme(rules: IEditorTokenTheme["rules"]): IEditorTokenTheme {
    return { rules };
}

describe("TokenThemeResolver", () => {
    it("returns empty style when no rules match", () => {
        const resolver = new TokenThemeResolver(theme([{ scope: "comment", settings: { foreground: "#ff0000" } }]));
        const result = resolver.resolve(["source", "keyword.control"]);
        expect(result.fg).toBeUndefined();
        expect(result.bold).toBe(false);
    });

    it("matches an exact scope", () => {
        const resolver = new TokenThemeResolver(
            theme([{ scope: "keyword.control", settings: { foreground: "#ff0000" } }]),
        );
        const result = resolver.resolve(["source", "keyword.control"]);
        expect(result.fg).toBe(RED);
    });

    it("matches via prefix on dot segments", () => {
        const resolver = new TokenThemeResolver(theme([{ scope: "keyword", settings: { foreground: "#ff0000" } }]));
        const result = resolver.resolve(["source", "keyword.control.flow"]);
        expect(result.fg).toBe(RED);
    });

    it("does NOT match a scope that is merely a substring", () => {
        const resolver = new TokenThemeResolver(theme([{ scope: "key", settings: { foreground: "#ff0000" } }]));
        const result = resolver.resolve(["source", "keyword.control"]);
        expect(result.fg).toBeUndefined();
    });

    it("more specific rule wins on foreground", () => {
        const resolver = new TokenThemeResolver(
            theme([
                { scope: "keyword", settings: { foreground: "#ff0000" } },
                { scope: "keyword.control", settings: { foreground: "#0000ff" } },
            ]),
        );
        const result = resolver.resolve(["source", "keyword.control"]);
        expect(result.fg).toBe(BLUE);
    });

    it("expands a scope-array rule into multiple selectors", () => {
        const resolver = new TokenThemeResolver(
            theme([{ scope: ["keyword", "constant"], settings: { foreground: "#00ff00" } }]),
        );
        expect(resolver.resolve(["source", "keyword"]).fg).toBe(GREEN);
        expect(resolver.resolve(["source", "constant.numeric"]).fg).toBe(GREEN);
    });

    it("merges fontStyle: bold/italic flags", () => {
        const resolver = new TokenThemeResolver(
            theme([{ scope: "keyword", settings: { fontStyle: "bold italic underline" } }]),
        );
        const result = resolver.resolve(["source", "keyword"]);
        expect(result.bold).toBe(true);
        expect(result.italic).toBe(true);
        expect(result.underline).toBe(true);
    });

    it("foreground/background/fontStyle cascade independently", () => {
        const resolver = new TokenThemeResolver(
            theme([
                { scope: "keyword", settings: { foreground: "#ff0000", fontStyle: "bold" } },
                { scope: "keyword.control", settings: { background: "#0000ff" } },
            ]),
        );
        const result = resolver.resolve(["source", "keyword.control"]);
        // background comes from the more specific rule
        expect(result.bg).toBe(BLUE);
        // foreground / bold inherit from the less specific rule
        expect(result.fg).toBe(RED);
        expect(result.bold).toBe(true);
    });

    it("returns the same object on a cache hit", () => {
        const resolver = new TokenThemeResolver(theme([{ scope: "keyword", settings: { foreground: "#ff0000" } }]));
        const a = resolver.resolve(["source", "keyword"]);
        const b = resolver.resolve(["source", "keyword"]);
        expect(a).toBe(b);
    });
});
