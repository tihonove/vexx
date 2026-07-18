import { describe, expect, it } from "vitest";

import { dark2026Theme } from "../Theme/themes/dark2026.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { TUIElement } from "../TUIDom/TUIElement.ts";

import { ThemedComponent } from "./Component.ts";

class TestComponent extends ThemedComponent {
    public readonly view = new TUIElement();
    public paintedThemes: WorkbenchTheme[] = [];

    public constructor(themeService: ThemeService) {
        super(themeService);
        this.initStyles();
    }

    public get activeTheme(): WorkbenchTheme {
        return this.theme;
    }

    protected updateStyles(): void {
        this.paintedThemes.push(this.theme);
    }
}

function makeThemes(): { initial: WorkbenchTheme; next: WorkbenchTheme } {
    return {
        initial: WorkbenchTheme.fromThemeFile(darkPlusTheme),
        next: WorkbenchTheme.fromThemeFile(dark2026Theme),
    };
}

describe("ThemedComponent", () => {
    it("paints exactly once on construction with the current theme", () => {
        const { initial } = makeThemes();
        const themeService = new ThemeService(initial);

        const component = new TestComponent(themeService);

        expect(component.paintedThemes).toEqual([initial]);
    });

    it("exposes the active theme of the theme service", () => {
        const { initial, next } = makeThemes();
        const themeService = new ThemeService(initial);
        const component = new TestComponent(themeService);

        expect(component.activeTheme).toBe(initial);

        themeService.setTheme(next);

        expect(component.activeTheme).toBe(next);
    });

    it("repaints on every theme change", () => {
        const { initial, next } = makeThemes();
        const themeService = new ThemeService(initial);
        const component = new TestComponent(themeService);

        themeService.setTheme(next);
        themeService.setTheme(initial);

        expect(component.paintedThemes).toEqual([initial, next, initial]);
    });

    it("unsubscribes from theme changes on dispose", () => {
        const { initial, next } = makeThemes();
        const themeService = new ThemeService(initial);
        const component = new TestComponent(themeService);

        component.dispose();
        themeService.setTheme(next);

        expect(component.paintedThemes).toEqual([initial]);
    });
});
