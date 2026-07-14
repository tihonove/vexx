import { describe, expect, it } from "vitest";

import type { IEditorTokenTheme } from "../../../../platform/theme/common/editorTokenTheme.ts";

import { TokenThemeResolver } from "./tokenThemeResolver.ts";

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

    it("returns the empty style for an empty scope stack (line 92)", () => {
        const resolver = new TokenThemeResolver(theme([{ scope: "keyword", settings: { foreground: "#ff0000" } }]));
        const result = resolver.resolve([]);
        expect(result.fg).toBeUndefined();
        expect(result.bold).toBe(false);
    });

    it("expands a comma-separated string scope into multiple selectors (line 28 / 57-59)", () => {
        const resolver = new TokenThemeResolver(
            theme([{ scope: "keyword, constant.numeric", settings: { foreground: "#00ff00" } }]),
        );
        expect(resolver.resolve(["source", "keyword.control"]).fg).toBe(GREEN);
        expect(resolver.resolve(["source", "constant.numeric.hex"]).fg).toBe(GREEN);
    });

    it("a rule with no scope acts as a default that matches every scope (line 42)", () => {
        const resolver = new TokenThemeResolver(
            theme([
                { settings: { foreground: "#ff0000" } }, // default rule, scope undefined → ""
                { scope: "keyword", settings: { background: "#0000ff" } },
            ]),
        );
        // keyword gets its specific background AND inherits the default foreground.
        const kw = resolver.resolve(["source", "keyword"]);
        expect(kw.bg).toBe(BLUE);
        expect(kw.fg).toBe(RED);

        // An otherwise-unmatched scope still picks up the default foreground.
        const other = resolver.resolve(["source", "variable.other"]);
        expect(other.fg).toBe(RED);
    });

    describe("setTheme (color-theme swap)", () => {
        it("resolves with the new theme's colors after a swap", () => {
            const resolver = new TokenThemeResolver(theme([{ scope: "keyword", settings: { foreground: "#ff0000" } }]));
            expect(resolver.resolve(["source", "keyword"]).fg).toBe(RED);

            resolver.setTheme(theme([{ scope: "keyword", settings: { foreground: "#0000ff" } }]));
            // Same scope, new color — the cached RED must not leak through.
            expect(resolver.resolve(["source", "keyword"]).fg).toBe(BLUE);
        });

        it("drops rules that the new theme no longer defines", () => {
            const resolver = new TokenThemeResolver(theme([{ scope: "keyword", settings: { foreground: "#ff0000" } }]));
            expect(resolver.resolve(["source", "keyword"]).fg).toBe(RED);

            resolver.setTheme(theme([{ scope: "comment", settings: { foreground: "#00ff00" } }]));
            expect(resolver.resolve(["source", "keyword"]).fg).toBeUndefined();
            expect(resolver.resolve(["source", "comment"]).fg).toBe(GREEN);
        });
    });
});
