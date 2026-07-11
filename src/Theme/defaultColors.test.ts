import { describe, expect, it } from "vitest";

import type { IWorkbenchColors } from "./IWorkbenchColors.ts";
import { builtinThemes } from "./themes/builtinThemes.ts";
import { WorkbenchTheme } from "./WorkbenchTheme.ts";

/**
 * Every workbench color the app reads through `getRequiredColor` must resolve on
 * every built-in theme — either the theme defines it, or the default color
 * registry (src/Theme/defaultColors.ts) fills it. This is the guard behind the
 * architecture rule "no hardcoded color fallbacks in UI code": if a feature adds
 * a required color without a registry default, this test fails for the themes
 * that omit it.
 *
 * Keep this list in sync with the `getRequiredColor(...)` call sites.
 */
const REQUIRED_COLORS: (keyof IWorkbenchColors)[] = [
    "foreground",
    "sash.hoverBorder",
    "editor.foreground",
    "editor.background",
    "editorGroupHeader.tabsBackground",
    "tab.activeBackground",
    "tab.activeForeground",
    "tab.inactiveBackground",
    "tab.inactiveForeground",
    "sideBar.background",
    "sideBar.foreground",
    "statusBar.background",
    "statusBar.foreground",
    "list.activeSelectionBackground",
    "list.activeSelectionForeground",
    "list.inactiveSelectionBackground",
    "list.inactiveSelectionForeground",
    "list.hoverBackground",
    "list.deemphasizedForeground",
    "button.background",
    "button.foreground",
    "button.hoverBackground",
    "button.secondaryBackground",
    "button.secondaryForeground",
    "button.secondaryHoverBackground",
    "menu.foreground",
    "menu.background",
    "menu.selectionForeground",
    "menu.selectionBackground",
    "menu.border",
    "menu.separatorBackground",
];

describe("default color registry coverage", () => {
    for (const themeFile of builtinThemes) {
        it(`resolves every required color for "${themeFile.name ?? "Unnamed"}"`, () => {
            const theme = WorkbenchTheme.fromThemeFile(themeFile);
            for (const key of REQUIRED_COLORS) {
                expect(() => theme.getRequiredColor(key), `missing "${key}"`).not.toThrow();
            }
        });
    }
});
