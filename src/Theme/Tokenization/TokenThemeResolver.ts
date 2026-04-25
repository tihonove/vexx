import type { ITokenStyleResolver, ResolvedTokenStyle } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import { EMPTY_RESOLVED_TOKEN_STYLE } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import { parseHexColor } from "../ColorUtils.ts";
import type { IEditorTokenTheme } from "../IEditorTokenTheme.ts";
import type { ITokenColorRule } from "../IThemeFile.ts";

interface CompiledRule {
    /** Single scope selector (we expand `scope: ["a", "b"]` into two compiled rules). */
    readonly scope: string;
    /** Number of dot-separated segments — used to break ties (more specific wins). */
    readonly segments: number;
    /** Original index — used to break ties between equally-specific rules. */
    readonly order: number;
    readonly fg?: number;
    readonly bg?: number;
    readonly bold: boolean;
    readonly italic: boolean;
    readonly underline: boolean;
    readonly strikethrough: boolean;
    readonly hasFontStyle: boolean;
}

function compileRules(rules: readonly ITokenColorRule[]): CompiledRule[] {
    const compiled: CompiledRule[] = [];
    let order = 0;
    for (const rule of rules) {
        const scopes =
            rule.scope === undefined ? [""] : Array.isArray(rule.scope) ? rule.scope : splitScopeSelector(rule.scope);
        const fg = rule.settings.foreground !== undefined ? parseHexColor(rule.settings.foreground) : undefined;
        const bg = rule.settings.background !== undefined ? parseHexColor(rule.settings.background) : undefined;
        const fontStyle = rule.settings.fontStyle;
        const hasFontStyle = fontStyle !== undefined;
        const bold = hasFontStyle && /\bbold\b/.test(fontStyle);
        const italic = hasFontStyle && /\bitalic\b/.test(fontStyle);
        const underline = hasFontStyle && /\bunderline\b/.test(fontStyle);
        const strikethrough = hasFontStyle && /\bstrikethrough\b/.test(fontStyle);

        for (const scope of scopes) {
            const trimmed = scope.trim();
            compiled.push({
                scope: trimmed,
                segments: trimmed === "" ? 0 : trimmed.split(".").length,
                order: order++,
                fg,
                bg,
                bold,
                italic,
                underline,
                strikethrough,
                hasFontStyle,
            });
        }
    }
    return compiled;
}

function splitScopeSelector(selector: string): string[] {
    return selector.split(",").map((s) => s.trim());
}

function scopeMatches(ruleScope: string, scope: string): boolean {
    if (ruleScope === "") return true;
    if (ruleScope === scope) return true;
    return scope.startsWith(ruleScope + ".");
}

/**
 * Minimal TextMate scope → style resolver.
 *
 * Walks the scope stack from most specific to least specific; for each scope
 * picks the most specific matching rule (longest-prefix on dot segments,
 * later-defined wins on ties). `foreground`, `background` and `fontStyle`
 * cascade independently — the first defined value found wins for each axis.
 *
 * Full TextMate scope selectors (parent selectors `meta.foo bar`, exclusion
 * `-bar`, weighted matches) are NOT implemented yet — see TODO.
 */
export class TokenThemeResolver implements ITokenStyleResolver {
    private readonly rules: CompiledRule[];
    private readonly cache = new Map<string, ResolvedTokenStyle>();

    public constructor(theme: IEditorTokenTheme) {
        this.rules = compileRules(theme.rules);
        // Sort by specificity desc, then by definition order desc (later wins).
        this.rules.sort((a, b) => {
            if (a.segments !== b.segments) return b.segments - a.segments;
            return b.order - a.order;
        });
    }

    public resolve(scopes: readonly string[]): ResolvedTokenStyle {
        if (scopes.length === 0) return EMPTY_RESOLVED_TOKEN_STYLE;
        const key = scopes.join(" ");
        const cached = this.cache.get(key);
        if (cached) return cached;

        let fg: number | undefined;
        let bg: number | undefined;
        let bold = false;
        let italic = false;
        let underline = false;
        let strikethrough = false;
        let fgFound = false;
        let bgFound = false;
        let fontStyleFound = false;

        // Walk from most specific (top) to most general (root).
        for (let scopeIdx = scopes.length - 1; scopeIdx >= 0; scopeIdx--) {
            const scope = scopes[scopeIdx];
            for (const rule of this.rules) {
                if (!scopeMatches(rule.scope, scope)) continue;
                if (!fgFound && rule.fg !== undefined) {
                    fg = rule.fg;
                    fgFound = true;
                }
                if (!bgFound && rule.bg !== undefined) {
                    bg = rule.bg;
                    bgFound = true;
                }
                if (!fontStyleFound && rule.hasFontStyle) {
                    bold = rule.bold;
                    italic = rule.italic;
                    underline = rule.underline;
                    strikethrough = rule.strikethrough;
                    fontStyleFound = true;
                }
                if (fgFound && bgFound && fontStyleFound) break;
            }
            if (fgFound && bgFound && fontStyleFound) break;
        }

        const result: ResolvedTokenStyle = { fg, bg, bold, italic, underline, strikethrough };
        this.cache.set(key, result);
        return result;
    }
}
