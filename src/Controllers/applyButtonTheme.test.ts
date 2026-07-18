import { describe, expect, it } from "vitest";

import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { ButtonElement } from "../TUIDom/Widgets/ButtonElement.ts";

import { applyButtonTheme } from "./applyButtonTheme.ts";

describe("applyButtonTheme", () => {
    it("maps button.* theme keys onto the control's color props", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);
        const button = new ButtonElement("OK");

        applyButtonTheme(button, theme);

        expect(button.focusedBg).toBe(theme.getRequiredColor("button.background"));
        expect(button.focusedFg).toBe(theme.getRequiredColor("button.foreground"));
        expect(button.focusedHoverBg).toBe(theme.getRequiredColor("button.hoverBackground"));
        expect(button.normalBg).toBe(theme.getRequiredColor("button.secondaryBackground"));
        expect(button.normalFg).toBe(theme.getRequiredColor("button.secondaryForeground"));
        expect(button.normalHoverBg).toBe(theme.getRequiredColor("button.secondaryHoverBackground"));
    });

    it("overwrites the control's standalone defaults with the theme's values", () => {
        const theme = WorkbenchTheme.fromThemeFile({
            name: "test",
            type: "dark",
            colors: { "button.background": "#123456" },
        });
        const button = new ButtonElement("OK");
        const before = button.focusedBg;

        applyButtonTheme(button, theme);

        expect(button.focusedBg).not.toBe(before);
        expect(button.focusedBg).toBe(theme.getRequiredColor("button.background"));
    });
});
