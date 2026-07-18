import type { IThemeFile } from "./IThemeFile.ts";

/**
 * Default workbench color values, mirroring VS Code's built-in default color
 * registry (`registerColor(...)` in `vs/platform/theme/common/colorRegistry`).
 *
 * WHY THIS EXISTS
 * ---------------
 * VS Code theme JSON files are intentionally sparse: they override only a
 * subset of colors, and everything else falls back to per-type defaults baked
 * into VS Code's TypeScript color registry — NOT into the theme JSON. Since we
 * import our built-in themes verbatim (`scripts/import-vscode-themes.mjs`, which
 * only resolves the JSON `include` chain), those defaulted colors are simply
 * absent from the imported files.
 *
 * `WorkbenchTheme.fromThemeFile` layers this table UNDER a theme's own colors
 * (theme wins), so any workbench color the app reads resolves to a value on
 * every theme — exactly as it does in VS Code.
 *
 * RULE (see docs/arch/Theme.md): application code never hardcodes colors and
 * never passes an inline fallback. It reads colors through
 * `theme.getColor(key)` / `theme.getRequiredColor(key)`. Any color a feature
 * needs must live here (dark + light) so it is guaranteed across all themes.
 * When you add a feature that needs a new color, add its key here.
 *
 * Values are VS Code hex strings (same format as theme JSON); alpha is dropped
 * on parse. Keys omitted from a variant are genuinely optional — the consumer
 * handles `undefined` (e.g. `list.hoverForeground`, `editorGutter.background`).
 */
export type ThemeKind = "dark" | "light";

const darkDefaults: Record<string, string> = {
    // ── Base ────────────────────────────────────────────────
    foreground: "#CCCCCC",
    focusBorder: "#007FD4",
    "sash.hoverBorder": "#007FD4",

    // ── Editor ──────────────────────────────────────────────
    "editor.background": "#1E1E1E",
    "editor.foreground": "#D4D4D4",
    "editorLineNumber.foreground": "#858585",
    "editorLineNumber.activeForeground": "#C6C6C6",
    "editorCursor.foreground": "#AEAFAD",
    // Opaque approximation of VS Code's #575757b8 composited over the editor bg.
    "editor.wordHighlightBackground": "#474747",

    // ── Editor — diagnostics squiggles ──────────────────────
    "editorError.foreground": "#F14C4C",
    "editorWarning.foreground": "#CCA700",
    "editorInfo.foreground": "#3794FF",
    "editorHint.foreground": "#EEEEEE",

    // ── Panel (Problems/Output/…) ───────────────────────────
    "panel.background": "#181818",
    "panel.border": "#2B2B2B",
    "panelTitle.activeBorder": "#E7E7E7",
    "panelTitle.activeForeground": "#E7E7E7",
    "panelTitle.inactiveForeground": "#8E8E8E",

    // ── Integrated Terminal ─────────────────────────────────
    "terminal.background": "#181818",
    "terminal.foreground": "#CCCCCC",

    // ── Editor groups & tabs ────────────────────────────────
    "editorGroupHeader.tabsBackground": "#252526",
    "tab.activeBackground": "#1E1E1E",
    "tab.activeForeground": "#FFFFFF",
    "tab.inactiveBackground": "#2D2D2D",
    "tab.inactiveForeground": "#FFFFFF80",

    // ── Side bar ────────────────────────────────────────────
    "sideBar.background": "#252526",
    "sideBar.foreground": "#CCCCCC",

    // ── Status bar ──────────────────────────────────────────
    "statusBar.background": "#007ACC",
    "statusBar.foreground": "#FFFFFF",

    // ── Lists & trees ───────────────────────────────────────
    "list.activeSelectionBackground": "#04395E",
    "list.activeSelectionForeground": "#FFFFFF",
    "list.inactiveSelectionBackground": "#37373D",
    "list.inactiveSelectionForeground": "#CCCCCC",
    "list.hoverBackground": "#2A2D2E",
    "list.deemphasizedForeground": "#808080",

    // ── Scrollbar control ───────────────────────────────────
    // `scrollbarSlider.background` mirrors VS Code's registry default. VS Code
    // leaves `scrollbar.background` unset (a transparent track); we draw the
    // track as a visible dim line, so it needs a real value here.
    "scrollbarSlider.background": "#79797966",
    "scrollbar.background": "#3A3D3E",

    // ── Buttons ─────────────────────────────────────────────
    "button.background": "#0078D7",
    "button.foreground": "#FFFFFF",
    "button.hoverBackground": "#1A86E0",
    "button.secondaryBackground": "#3C3C3C",
    "button.secondaryForeground": "#CCCCCC",
    "button.secondaryHoverBackground": "#45494E",

    // ── Menus ───────────────────────────────────────────────
    "menu.foreground": "#CCCCCC",
    "menu.background": "#252526",
    "menu.selectionForeground": "#FFFFFF",
    "menu.selectionBackground": "#04395E",
    "menu.border": "#535353",
    "menu.separatorBackground": "#535353",

    // ── Editor — Gutter (SCM diff) ──────────────────────────
    "editorGutter.modifiedBackground": "#1B81A8",
    "editorGutter.addedBackground": "#487E02",
    "editorGutter.deletedBackground": "#F14C4C",

    // ── Git colors ──────────────────────────────────────────
    "gitDecoration.addedResourceForeground": "#81B88B",
    "gitDecoration.modifiedResourceForeground": "#E2C08D",
    "gitDecoration.deletedResourceForeground": "#C74E39",
    "gitDecoration.renamedResourceForeground": "#73C991",
    "gitDecoration.untrackedResourceForeground": "#73C991",
    "gitDecoration.ignoredResourceForeground": "#8C8C8C",
    "gitDecoration.conflictingResourceForeground": "#E4676B",
    "gitDecoration.submoduleResourceForeground": "#8DB9E2",
};

const lightDefaults: Record<string, string> = {
    // ── Base ────────────────────────────────────────────────
    foreground: "#3B3B3B",
    focusBorder: "#0090F1",
    "sash.hoverBorder": "#0090F1",

    // ── Editor ──────────────────────────────────────────────
    "editor.background": "#FFFFFF",
    "editor.foreground": "#3B3B3B",
    "editorLineNumber.foreground": "#6E7681",
    "editorLineNumber.activeForeground": "#171184",
    "editorCursor.foreground": "#000000",
    // Opaque approximation of VS Code's #57575740 composited over white.
    "editor.wordHighlightBackground": "#C6C6C6",

    // ── Editor — diagnostics squiggles ──────────────────────
    "editorError.foreground": "#E51400",
    "editorWarning.foreground": "#BF8803",
    "editorInfo.foreground": "#1A85FF",
    "editorHint.foreground": "#6C6C6C",

    // ── Panel (Problems/Output/…) ───────────────────────────
    "panel.background": "#F8F8F8",
    "panel.border": "#E5E5E5",
    "panelTitle.activeBorder": "#3B3B3B",
    "panelTitle.activeForeground": "#3B3B3B",
    "panelTitle.inactiveForeground": "#8C8C8C",

    // ── Integrated Terminal ─────────────────────────────────
    "terminal.background": "#F8F8F8",
    "terminal.foreground": "#333333",

    // ── Editor groups & tabs ────────────────────────────────
    "editorGroupHeader.tabsBackground": "#F8F8F8",
    "tab.activeBackground": "#FFFFFF",
    "tab.activeForeground": "#3B3B3B",
    "tab.inactiveBackground": "#F8F8F8",
    "tab.inactiveForeground": "#868686",

    // ── Side bar ────────────────────────────────────────────
    "sideBar.background": "#F8F8F8",
    "sideBar.foreground": "#3B3B3B",

    // ── Status bar ──────────────────────────────────────────
    "statusBar.background": "#F8F8F8",
    "statusBar.foreground": "#3B3B3B",

    // ── Lists & trees ───────────────────────────────────────
    "list.activeSelectionBackground": "#E8E8E8",
    "list.activeSelectionForeground": "#000000",
    "list.inactiveSelectionBackground": "#E4E6F1",
    "list.inactiveSelectionForeground": "#3B3B3B",
    "list.hoverBackground": "#F2F2F2",
    "list.deemphasizedForeground": "#8E8E90",

    // ── Scrollbar control ───────────────────────────────────
    "scrollbarSlider.background": "#64646466",
    "scrollbar.background": "#DADADA",

    // ── Buttons ─────────────────────────────────────────────
    "button.background": "#005FB8",
    "button.foreground": "#FFFFFF",
    "button.hoverBackground": "#0258A8",
    "button.secondaryBackground": "#E5E5E5",
    "button.secondaryForeground": "#3B3B3B",
    "button.secondaryHoverBackground": "#CCCCCC",

    // ── Menus ───────────────────────────────────────────────
    "menu.foreground": "#616161",
    "menu.background": "#FFFFFF",
    "menu.selectionForeground": "#FFFFFF",
    "menu.selectionBackground": "#005FB8",
    "menu.border": "#CECECE",
    "menu.separatorBackground": "#D4D4D4",

    // ── Editor — Gutter (SCM diff) ──────────────────────────
    "editorGutter.modifiedBackground": "#2090D3",
    "editorGutter.addedBackground": "#48985D",
    "editorGutter.deletedBackground": "#E51400",

    // ── Git colors ──────────────────────────────────────────
    "gitDecoration.addedResourceForeground": "#587C0C",
    "gitDecoration.modifiedResourceForeground": "#895503",
    "gitDecoration.deletedResourceForeground": "#AD0707",
    "gitDecoration.renamedResourceForeground": "#007100",
    "gitDecoration.untrackedResourceForeground": "#007100",
    "gitDecoration.ignoredResourceForeground": "#8E8E90",
    "gitDecoration.conflictingResourceForeground": "#AD0707",
    "gitDecoration.submoduleResourceForeground": "#1258A7",
};

const defaultsByKind: Record<ThemeKind, Record<string, string>> = {
    dark: darkDefaults,
    light: lightDefaults,
};

/** Maps a theme's `type` (`dark` / `light` / `hc*`) to a default palette kind. */
export function themeKindOf(type: IThemeFile["type"]): ThemeKind {
    return type === "light" || type === "hcLight" ? "light" : "dark";
}

/** The default workbench colors (hex strings) for a theme kind. */
export function defaultWorkbenchColors(kind: ThemeKind): Record<string, string> {
    return defaultsByKind[kind];
}
