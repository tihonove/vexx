import { describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { StatusBarElement } from "../TUIDom/Widgets/StatusBarElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

interface TestAppContext {
    testApp: TestApp;
    controller: AppController;
    commandRegistry: CommandRegistry;
    themeService: ThemeService;
}

function createTestAppController(size: Size = new Size(80, 24)): TestAppContext {
    const { container, bindApp } = createTestContainer();
    const controller = container.get(AppControllerDIToken);
    controller.mount();
    const testApp = TestApp.create(controller.view, size);
    bindApp(testApp.app);
    return {
        testApp,
        controller,
        commandRegistry: container.get(CommandRegistryDIToken),
        themeService: container.get(ThemeServiceDIToken),
    };
}

describe("AppController — theme application", () => {
    it("applies foreground/background colors when the theme defines them", () => {
        const { controller, themeService } = createTestAppController();

        const theme = new WorkbenchTheme(
            "colored",
            "dark",
            { foreground: 0xaabbcc, "editor.background": 0x102030 },
            { rules: [] },
        );
        themeService.setTheme(theme);

        expect(controller.view.style.fg).toBe(0xaabbcc);
        expect(controller.view.style.bg).toBe(0x102030);
    });

    it("omits colors the theme does not define (no foreground/background)", () => {
        const { controller, themeService } = createTestAppController();

        // A theme with neither "foreground" nor "editor.background".
        const sparseTheme = new WorkbenchTheme("sparse", "dark", {}, { rules: [] });
        themeService.setTheme(sparseTheme);

        expect(controller.view.style.fg).toBeUndefined();
        expect(controller.view.style.bg).toBeUndefined();
    });
});

describe("AppController — chord with standalone modifier key", () => {
    function statusTexts(testApp: TestApp): string[] {
        const statusBar = testApp.querySelector("StatusBarElement") as StatusBarElement;
        return statusBar.getItems().map((i) => i.text);
    }

    it("a standalone modifier keydown while a chord is pending is not swallowed by the chord-capture layer", () => {
        const { testApp, controller } = createTestAppController();
        controller.openFile("/tmp/chord-modifier.txt");
        controller.focusEditor();

        testApp.sendKey("Ctrl+K");
        expect(statusTexts(testApp).some((t) => t.includes("Waiting"))).toBe(true);

        // Kitty protocol delivers a standalone Shift keydown while the chord waits.
        // The capture handler special-cases modifier keys (it returns early instead of
        // intercepting/swallowing them), so the event is allowed to propagate normally.
        testApp.backend.sendRaw("\x1b[57441;1:1u"); // Shift down

        // The waiting hint is gone — the modifier reached the bubble dispatcher rather
        // than being consumed silently by the chord-capture interceptor.
        expect(statusTexts(testApp).some((t) => t.includes("Waiting"))).toBe(false);
    });
});
