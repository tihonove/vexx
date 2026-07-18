import { describe, expect, it } from "vitest";

import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import { unthemedMenuStyles } from "../../TUIDom/Widgets/PopupMenuItemElement.tsx";

import {
    getAboutDialogStyles,
    getConfirmDialogStyles,
    getConfirmSaveDialogStyles,
    getDialogButtonStyles,
    getFindWidgetStyles,
    getMenuStyles,
} from "./defaultStyles.ts";

function makeTheme(): WorkbenchTheme {
    return WorkbenchTheme.fromThemeFile(darkPlusTheme);
}

describe("getDialogButtonStyles", () => {
    it("maps the focused button to the primary and the unfocused one to the secondary tokens", () => {
        const theme = makeTheme();

        const styles = getDialogButtonStyles(theme);

        expect(styles.fg).toBe(theme.getRequiredColor("button.secondaryForeground"));
        expect(styles.bg).toBe(theme.getRequiredColor("button.secondaryBackground"));
        expect(styles.hoverBg).toBe(theme.getRequiredColor("button.secondaryHoverBackground"));
        expect(styles.focusedFg).toBe(theme.getRequiredColor("button.foreground"));
        expect(styles.focusedBg).toBe(theme.getRequiredColor("button.background"));
        expect(styles.focusedHoverBg).toBe(theme.getRequiredColor("button.hoverBackground"));
    });
});

describe("dialog and find-widget styles", () => {
    it("getConfirmDialogStyles reuses the dialog button mapping", () => {
        const theme = makeTheme();
        expect(getConfirmDialogStyles(theme)).toEqual({ button: getDialogButtonStyles(theme) });
    });

    it("getConfirmSaveDialogStyles reuses the dialog button mapping", () => {
        const theme = makeTheme();
        expect(getConfirmSaveDialogStyles(theme)).toEqual({ button: getDialogButtonStyles(theme) });
    });

    it("getAboutDialogStyles reuses the dialog button mapping", () => {
        const theme = makeTheme();
        expect(getAboutDialogStyles(theme)).toEqual({ button: getDialogButtonStyles(theme) });
    });

    it("getFindWidgetStyles reuses the dialog button mapping", () => {
        const theme = makeTheme();
        expect(getFindWidgetStyles(theme)).toEqual({ button: getDialogButtonStyles(theme) });
    });
});

describe("getMenuStyles", () => {
    it("resolves the menu.* keys from the theme", () => {
        const theme = makeTheme();

        const styles = getMenuStyles(theme);

        expect(styles.fg).toBe(theme.getRequiredColor("menu.foreground"));
        expect(styles.bg).toBe(theme.getRequiredColor("menu.background"));
        expect(styles.highlightFg).toBe(theme.getRequiredColor("menu.selectionForeground"));
        expect(styles.highlightBg).toBe(theme.getRequiredColor("menu.selectionBackground"));
        expect(styles.borderFg).toBe(theme.getRequiredColor("menu.border"));
        expect(styles.separatorFg).toBe(theme.getRequiredColor("menu.separatorBackground"));
    });

    it("keeps shortcutFg from the unthemed baseline (no VS Code key for it)", () => {
        const theme = makeTheme();

        expect(getMenuStyles(theme).shortcutFg).toBe(unthemedMenuStyles.shortcutFg);
    });

    it("honors theme overrides of the secondary button and menu colors", () => {
        // Overrides only some tokens; the rest are supplied by the default color registry.
        const theme = WorkbenchTheme.fromThemeFile({
            name: "test",
            type: "dark",
            colors: {
                "button.secondaryBackground": "#0B1621",
                "menu.background": "#123456",
            },
        });

        expect(getDialogButtonStyles(theme).bg).toBe(theme.getRequiredColor("button.secondaryBackground"));
        expect(getMenuStyles(theme).bg).toBe(theme.getRequiredColor("menu.background"));
    });
});
