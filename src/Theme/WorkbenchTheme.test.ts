import { describe, expect, it } from "vitest";

import { packRgb } from "../Rendering/ColorUtils.ts";

import type { IThemeFile } from "./IThemeFile.ts";
import { WorkbenchTheme } from "./WorkbenchTheme.ts";

describe("WorkbenchTheme", () => {
    const sampleTheme: IThemeFile = {
        name: "Test Theme",
        type: "dark",
        colors: {
            "editor.background": "#1E1E1E",
            "editor.foreground": "#D4D4D4",
            "statusBar.background": "#007ACC",
            "statusBar.foreground": "#FFFFFF",
        },
        tokenColors: [
            {
                scope: "comment",
                settings: { foreground: "#6A9955" },
            },
        ],
    };

    it("creates from VS Code theme JSON", () => {
        const theme = WorkbenchTheme.fromThemeFile(sampleTheme);
        expect(theme.name).toBe("Test Theme");
        expect(theme.type).toBe("dark");
    });

    it("converts hex colors to packed RGB", () => {
        const theme = WorkbenchTheme.fromThemeFile(sampleTheme);
        expect(theme.colors["editor.background"]).toBe(packRgb(0x1e, 0x1e, 0x1e));
        expect(theme.colors["editor.foreground"]).toBe(packRgb(0xd4, 0xd4, 0xd4));
        expect(theme.colors["statusBar.background"]).toBe(packRgb(0x00, 0x7a, 0xcc));
        expect(theme.colors["statusBar.foreground"]).toBe(packRgb(0xff, 0xff, 0xff));
    });

    it("preserves token color rules", () => {
        const theme = WorkbenchTheme.fromThemeFile(sampleTheme);
        expect(theme.tokenTheme.rules).toHaveLength(1);
        expect(theme.tokenTheme.rules[0].scope).toBe("comment");
        expect(theme.tokenTheme.rules[0].settings.foreground).toBe("#6A9955");
    });

    it("getColor returns color when defined", () => {
        const theme = WorkbenchTheme.fromThemeFile(sampleTheme);
        expect(theme.getColor("editor.background")).toBe(packRgb(0x1e, 0x1e, 0x1e));
    });

    it("getColor returns undefined for missing keys", () => {
        const theme = WorkbenchTheme.fromThemeFile(sampleTheme);
        expect(theme.getColor("editorCursor.foreground")).toBeUndefined();
    });

    it("getColorOrDefault returns color when defined", () => {
        const theme = WorkbenchTheme.fromThemeFile(sampleTheme);
        expect(theme.getColorOrDefault("editor.background", 0)).toBe(packRgb(0x1e, 0x1e, 0x1e));
    });

    it("getColorOrDefault returns default for missing keys", () => {
        const theme = WorkbenchTheme.fromThemeFile(sampleTheme);
        expect(theme.getColorOrDefault("editorCursor.foreground", 42)).toBe(42);
    });

    it("defaults to 'dark' type and 'Unnamed' when not specified", () => {
        const theme = WorkbenchTheme.fromThemeFile({ colors: {} });
        expect(theme.name).toBe("Unnamed");
        expect(theme.type).toBe("dark");
    });

    it("defaults to empty tokenColors when not specified", () => {
        const theme = WorkbenchTheme.fromThemeFile({ colors: {} });
        expect(theme.tokenTheme.rules).toEqual([]);
    });
});
