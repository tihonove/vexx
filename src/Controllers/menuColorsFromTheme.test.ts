import { describe, expect, it } from "vitest";

import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { DEFAULT_MENU_COLORS } from "../TUIDom/Widgets/PopupMenuItemElement.tsx";

import { menuColorsFromTheme } from "./menuColorsFromTheme.ts";

describe("menuColorsFromTheme", () => {
    it("maps menu.* theme keys onto the plain MenuColors palette", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);

        const colors = menuColorsFromTheme(theme);

        expect(colors.fg).toBe(theme.getRequiredColor("menu.foreground"));
        expect(colors.bg).toBe(theme.getRequiredColor("menu.background"));
        expect(colors.highlightFg).toBe(theme.getRequiredColor("menu.selectionForeground"));
        expect(colors.highlightBg).toBe(theme.getRequiredColor("menu.selectionBackground"));
        expect(colors.borderFg).toBe(theme.getRequiredColor("menu.border"));
        expect(colors.separatorFg).toBe(theme.getRequiredColor("menu.separatorBackground"));
    });

    it("keeps the unthemable shortcut color at the control's baseline default", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);

        // У VS Code нет ключа темы для цвета шортката — остаётся дефолт контрола.
        expect(menuColorsFromTheme(theme).shortcutFg).toBe(DEFAULT_MENU_COLORS.shortcutFg);
    });
});
