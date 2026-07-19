import { describe, expect, it } from "vitest";

import { parseHexColor } from "../common/colorUtils.ts";
import { darkPlusTheme } from "../../../workbench/services/themes/common/themes/darkPlus.ts";
import { WorkbenchTheme } from "../common/workbenchTheme.ts";
import { unthemedScrollBarStyles } from "../../../base/browser/ui/scrollbar/scrollContainerElement.ts";

import { getScrollBarStyles } from "./defaultStyles.ts";

describe("getScrollBarStyles", () => {
    it("resolves thumb and track from the theme", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);

        const styles = getScrollBarStyles(theme, "editor.background");

        expect(styles.thumb).toBe(theme.getRequiredColor("scrollbarSlider.background"));
        expect(styles.track).toBe(theme.getRequiredColor("scrollbar.background"));
    });

    it("fills the bar's row/column with the host widget's own background", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);

        const styles = getScrollBarStyles(theme, "editor.background");

        // Иначе строка скроллбара осталась бы с фоном терминала — та самая «дыра».
        expect(styles.background).toBe(theme.getRequiredColor("editor.background"));
    });

    it("takes the background from the key it is given, not a fixed one", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);

        const editorStyles = getScrollBarStyles(theme, "editor.background");
        const sideBarStyles = getScrollBarStyles(theme, "sideBar.background");

        expect(sideBarStyles.background).toBe(theme.getRequiredColor("sideBar.background"));
        expect(sideBarStyles.background).not.toBe(editorStyles.background);
    });

    it("differs from the widget's standalone (unthemed) defaults", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);

        const styles = getScrollBarStyles(theme, "editor.background");

        expect(styles.thumb).not.toBe(unthemedScrollBarStyles.thumb);
    });

    it("strips the alpha channel the theme carries on the slider colour", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);

        const styles = getScrollBarStyles(theme, "editor.background");

        // `#79797966` → непрозрачный `#797979`: альфы в модели цвета TUI нет.
        expect(styles.thumb).toBe(parseHexColor("#797979"));
    });
});
