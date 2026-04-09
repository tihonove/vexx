import { DEFAULT_COLOR } from "../../Rendering/ColorUtils.ts";

// ─── Meta Colors ───
// Sentinel values that reference inherited cascade tokens.
// Start at -100 to avoid collision with DEFAULT_COLOR (-1).

export const META_DEFAULT_FG = -100;
export const META_DEFAULT_BG = -101;

// ─── StyleColor type ───
// A color value that can be:
// - packed 24-bit RGB (0x000000–0xFFFFFF)
// - DEFAULT_COLOR (-1): terminal default
// - META_DEFAULT_FG (-100): resolve to inherited defaultFg
// - META_DEFAULT_BG (-101): resolve to inherited defaultBg
export type StyleColor = number;

// ─── TUIStyle ───
// Declarative style set by the user on an element.
// All fields optional — undefined means "inherit from parent cascade".

export interface TUIStyle {
    // Cascade tokens: set a new default for this subtree
    defaultFg?: number;
    defaultBg?: number;

    // Element's own colors (concrete RGB, meta-color, or undefined=inherit)
    fg?: StyleColor;
    bg?: StyleColor;
}

// ─── ResolvedTUIStyle ───
// Fully resolved style with only concrete values (no undefined, no meta-colors).

export interface ResolvedTUIStyle {
    readonly defaultFg: number;
    readonly defaultBg: number;
    readonly fg: number;
    readonly bg: number;
}

// ─── Root default ───

export const ROOT_RESOLVED_STYLE: ResolvedTUIStyle = {
    defaultFg: DEFAULT_COLOR,
    defaultBg: DEFAULT_COLOR,
    fg: DEFAULT_COLOR,
    bg: DEFAULT_COLOR,
};

// ─── Resolution functions ───

export function resolveStyleColor(color: StyleColor | undefined, defaultFg: number, defaultBg: number): number {
    if (color === undefined) return DEFAULT_COLOR;
    if (color === META_DEFAULT_FG) return defaultFg;
    if (color === META_DEFAULT_BG) return defaultBg;
    return color;
}

export function resolveStyle(style: TUIStyle, inherited: ResolvedTUIStyle): ResolvedTUIStyle {
    // Cascade tokens: if element defines a new default, use it; otherwise inherit
    const defaultFg = style.defaultFg ?? inherited.defaultFg;
    const defaultBg = style.defaultBg ?? inherited.defaultBg;

    // Element's own colors: undefined → inherited cascade token; meta → resolve
    const fg = style.fg === undefined ? defaultFg : resolveStyleColor(style.fg, defaultFg, defaultBg);
    const bg = style.bg === undefined ? defaultBg : resolveStyleColor(style.bg, defaultFg, defaultBg);

    return { defaultFg, defaultBg, fg, bg };
}
