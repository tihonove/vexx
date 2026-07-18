import { describe, expect, it } from "vitest";

import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import { unthemedMenuStyles } from "../../TUIDom/Widgets/PopupMenuItemElement.tsx";
import { unthemedTreeViewStyles } from "../../TUIDom/Widgets/TreeViewElement.ts";

import {
    getAboutDialogStyles,
    getConfirmDialogStyles,
    getConfirmSaveDialogStyles,
    getDialogButtonStyles,
    getFileTreeStyles,
    getFindWidgetStyles,
    getMenuStyles,
    getPanelContainerStyles,
    getProblemsTreeStyles,
    getTabStripStyles,
    getTerminalViewStyles,
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

describe("getFileTreeStyles", () => {
    it("resolves the list.* selection/hover keys from the theme", () => {
        const theme = makeTheme();

        const styles = getFileTreeStyles(theme);

        expect(styles.activeSelectionBg).toBe(theme.getRequiredColor("list.activeSelectionBackground"));
        expect(styles.activeSelectionFg).toBe(theme.getRequiredColor("list.activeSelectionForeground"));
        expect(styles.inactiveSelectionBg).toBe(theme.getRequiredColor("list.inactiveSelectionBackground"));
        expect(styles.inactiveSelectionFg).toBe(theme.getRequiredColor("list.inactiveSelectionForeground"));
        expect(styles.hoverBg).toBe(theme.getRequiredColor("list.hoverBackground"));
        expect(styles.hoverFg).toBe(theme.getColor("list.hoverForeground"));
    });

    it("deemphasizes cut rows and the symlink arrow with list.deemphasizedForeground", () => {
        const theme = makeTheme();

        const styles = getFileTreeStyles(theme);

        expect(styles.cutFg).toBe(theme.getRequiredColor("list.deemphasizedForeground"));
        expect(styles.symlinkFg).toBe(theme.getRequiredColor("list.deemphasizedForeground"));
    });
});

describe("getProblemsTreeStyles", () => {
    it("shares the list.* selection mapping with the file tree", () => {
        const theme = makeTheme();

        const styles = getProblemsTreeStyles(theme);
        const fileTree = getFileTreeStyles(theme);

        expect(styles.activeSelectionBg).toBe(fileTree.activeSelectionBg);
        expect(styles.activeSelectionFg).toBe(fileTree.activeSelectionFg);
        expect(styles.inactiveSelectionBg).toBe(fileTree.inactiveSelectionBg);
        expect(styles.inactiveSelectionFg).toBe(fileTree.inactiveSelectionFg);
        expect(styles.hoverBg).toBe(fileTree.hoverBg);
        expect(styles.hoverFg).toBe(fileTree.hoverFg);
    });

    it("keeps cut/symlink colours at the unthemed baseline (Problems never themed them)", () => {
        const theme = makeTheme();

        const styles = getProblemsTreeStyles(theme);

        expect(styles.cutFg).toBe(unthemedTreeViewStyles.cutFg);
        expect(styles.symlinkFg).toBe(unthemedTreeViewStyles.symlinkFg);
    });
});

describe("getTabStripStyles", () => {
    it("resolves the tab.* keys and the strip background from the theme", () => {
        const theme = makeTheme();

        const styles = getTabStripStyles(theme);

        expect(styles.activeFg).toBe(theme.getRequiredColor("tab.activeForeground"));
        expect(styles.activeBg).toBe(theme.getRequiredColor("tab.activeBackground"));
        expect(styles.inactiveFg).toBe(theme.getRequiredColor("tab.inactiveForeground"));
        expect(styles.inactiveBg).toBe(theme.getRequiredColor("tab.inactiveBackground"));
        expect(styles.stripBg).toBe(theme.getRequiredColor("editorGroupHeader.tabsBackground"));
    });
});

describe("getTerminalViewStyles", () => {
    it("resolves terminal.* colours when the theme defines them", () => {
        const theme = makeTheme();

        const styles = getTerminalViewStyles(theme);

        expect(styles.defaultBg).toBe(theme.getColor("terminal.background"));
        expect(styles.defaultFg).toBe(theme.getColor("terminal.foreground"));
    });

    it("falls back to panel/editor colours for themes without terminal colours", () => {
        const base = WorkbenchTheme.fromThemeFile({ name: "no-terminal", type: "dark", colors: {} });
        const colors = { ...base.colors };
        delete colors["terminal.background"];
        delete colors["terminal.foreground"];
        const theme = new WorkbenchTheme("no-terminal", "dark", colors, base.tokenTheme);

        const styles = getTerminalViewStyles(theme);

        expect(styles.defaultBg).toBe(theme.getRequiredColor("panel.background"));
        expect(styles.defaultFg).toBe(theme.getRequiredColor("editor.foreground"));
    });
});

describe("getPanelContainerStyles", () => {
    it("resolves the panel.* keys from the theme", () => {
        const theme = makeTheme();

        const styles = getPanelContainerStyles(theme);

        expect(styles.background).toBe(theme.getRequiredColor("panel.background"));
        expect(styles.titleForeground).toBe(theme.getRequiredColor("panelTitle.inactiveForeground"));
        expect(styles.borderColor).toBe(theme.getRequiredColor("panel.border"));
    });
});
