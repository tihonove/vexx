import type { IThemeFile } from "../IThemeFile.ts";

/**
 * Dark+ (default dark) theme — colors matching VS Code's built-in Dark+ theme.
 * Only the keys currently used by our workbench are included;
 * add more as we implement additional UI components.
 */
export const darkPlusTheme: IThemeFile = {
    name: "Dark+ (default dark)",
    type: "dark",
    colors: {
        // ── Base colors ─────────────────────────────────
        foreground: "#CCCCCC",
        focusBorder: "#007FD4",

        // ── Editor ──────────────────────────────────────
        "editor.background": "#1E1E1E",
        "editor.foreground": "#D4D4D4",
        "editorLineNumber.foreground": "#858585",
        "editorLineNumber.activeForeground": "#C6C6C6",
        "editorCursor.foreground": "#AEAFAD",
        "editor.selectionBackground": "#264F78",
        "editor.lineHighlightBackground": "#2A2D2E",
        "editorGutter.background": "#1E1E1E",

        // ── Activity Bar ────────────────────────────────
        "activityBar.background": "#333333",
        "activityBar.foreground": "#FFFFFF",

        // ── Side Bar ────────────────────────────────────
        "sideBar.background": "#252526",
        "sideBar.foreground": "#CCCCCC",

        // ── Title Bar ───────────────────────────────────
        "titleBar.activeBackground": "#3C3C3C",
        "titleBar.activeForeground": "#CCCCCC",

        // ── Editor Groups & Tabs ────────────────────────
        "editorGroupHeader.tabsBackground": "#252526",
        "tab.activeBackground": "#1E1E1E",
        "tab.activeForeground": "#FFFFFF",
        "tab.inactiveBackground": "#2D2D2D",
        "tab.inactiveForeground": "#FFFFFF80",

        // ── Status Bar ──────────────────────────────────
        "statusBar.background": "#007ACC",
        "statusBar.foreground": "#FFFFFF",

        // ── Lists and trees ─────────────────────────────
        "list.activeSelectionBackground": "#04395E",
        "list.activeSelectionForeground": "#FFFFFF",
        "list.inactiveSelectionBackground": "#37373D",
        "list.inactiveSelectionForeground": "#CCCCCC",
    },
    tokenColors: [
        {
            scope: ["comment", "punctuation.definition.comment"],
            settings: {
                foreground: "#6A9955",
            },
        },
        {
            scope: ["string", "string.quoted"],
            settings: {
                foreground: "#CE9178",
            },
        },
        {
            scope: ["keyword", "storage.type", "storage.modifier"],
            settings: {
                foreground: "#569CD6",
            },
        },
        {
            scope: ["constant.numeric"],
            settings: {
                foreground: "#B5CEA8",
            },
        },
        {
            scope: ["entity.name.function", "support.function"],
            settings: {
                foreground: "#DCDCAA",
            },
        },
        {
            scope: ["entity.name.type", "support.type", "support.class"],
            settings: {
                foreground: "#4EC9B0",
            },
        },
        {
            scope: ["variable", "variable.other"],
            settings: {
                foreground: "#9CDCFE",
            },
        },
        {
            scope: ["constant.language"],
            settings: {
                foreground: "#569CD6",
            },
        },
        {
            scope: ["entity.name.tag"],
            settings: {
                foreground: "#569CD6",
            },
        },
        {
            scope: ["entity.other.attribute-name"],
            settings: {
                foreground: "#9CDCFE",
            },
        },
    ],
};
