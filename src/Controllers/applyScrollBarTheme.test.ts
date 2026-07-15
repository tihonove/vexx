import { describe, expect, it } from "vitest";

import { parseHexColor } from "../Theme/ColorUtils.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { ScrollableElement } from "../TUIDom/Widgets/ScrollableElement.ts";
import { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";

import { applyScrollBarTheme } from "./applyScrollBarTheme.ts";

/** Минимальный скроллируемый ребёнок: тут важны только цвета, не отрисовка. */
class StubContent extends ScrollableElement {
    public get contentHeight(): number {
        return 100;
    }
    public get contentWidth(): number {
        return 100;
    }
    protected renderViewport(): void {
        /* ничего не рисуем */
    }
}

function makeDecorator(): ScrollBarDecorator {
    return new ScrollBarDecorator(new StubContent());
}

describe("applyScrollBarTheme", () => {
    it("resolves thumb and track from the theme", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);
        const view = makeDecorator();

        applyScrollBarTheme(view, theme, "editor.background");

        expect(view.thumbColor).toBe(theme.getRequiredColor("scrollbarSlider.background"));
        expect(view.trackColor).toBe(theme.getRequiredColor("scrollbar.background"));
    });

    it("fills the bar's row/column with the host widget's own background", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);
        const view = makeDecorator();

        applyScrollBarTheme(view, theme, "editor.background");

        // Иначе строка скроллбара осталась бы с фоном терминала — та самая «дыра».
        expect(view.backgroundColor).toBe(theme.getRequiredColor("editor.background"));
    });

    it("takes the background from the key it is given, not a fixed one", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);
        const editorView = makeDecorator();
        const sideBarView = makeDecorator();

        applyScrollBarTheme(editorView, theme, "editor.background");
        applyScrollBarTheme(sideBarView, theme, "sideBar.background");

        expect(sideBarView.backgroundColor).toBe(theme.getRequiredColor("sideBar.background"));
        expect(sideBarView.backgroundColor).not.toBe(editorView.backgroundColor);
    });

    it("overwrites the widget's standalone defaults", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);
        const view = makeDecorator();
        const before = view.thumbColor;

        applyScrollBarTheme(view, theme, "editor.background");

        expect(view.thumbColor).not.toBe(before);
    });

    it("is a no-op for a view that does not exist yet", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);

        // FileTreeController получает темы ещё до setRootPath — вью тогда нет.
        expect(() => {
            applyScrollBarTheme(null, theme, "sideBar.background");
        }).not.toThrow();
    });

    it("strips the alpha channel the theme carries on the slider colour", () => {
        const theme = WorkbenchTheme.fromThemeFile(darkPlusTheme);
        const view = makeDecorator();

        applyScrollBarTheme(view, theme, "editor.background");

        // `#79797966` → непрозрачный `#797979`: альфы в модели цвета TUI нет.
        expect(view.thumbColor).toBe(parseHexColor("#797979"));
    });
});
