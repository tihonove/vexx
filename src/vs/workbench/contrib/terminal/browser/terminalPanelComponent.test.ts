import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeTerminalSurface } from "../../../../../TestUtils/FakeTerminalSurface.ts";
import { TestApp } from "../../../../../TestUtils/TestApp.ts";
import { TerminalViewElement } from "../../../../base/browser/ui/terminal/terminalViewElement.ts";
import { Size } from "../../../../base/common/geometryPromitives.ts";
import { WorkbenchTheme } from "../../../../platform/theme/common/workbenchTheme.ts";
import { PanelComponent } from "../../../browser/parts/panel/panelComponent.ts";
import { PanelService } from "../../../browser/parts/panel/panelService.ts";
import { darkPlusTheme } from "../../../services/themes/common/themes/darkPlus.ts";
import { ThemeService } from "../../../services/themes/common/themeService.ts";
import type { TerminalSessionFactory } from "../common/terminalSessionFactory.ts";

import { TerminalPanelComponent } from "./terminalPanelComponent.ts";
import { TERMINAL_VIEW_ID, TerminalService } from "./terminalService.ts";

function buildHarness() {
    const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    const panelService = new PanelService();
    const panelComponent = new PanelComponent(panelService, themeService);
    const sessions: FakeTerminalSurface[] = [];
    const factory: TerminalSessionFactory = () => {
        const surface = new FakeTerminalSurface();
        sessions.push(surface);
        return surface;
    };
    const service = new TerminalService(panelService, factory);
    const component = new TerminalPanelComponent(service, panelService, themeService);
    const testApp = TestApp.createWithContent(panelComponent.view, new Size(70, 12));
    const dispose = (): void => {
        component.dispose();
        service.dispose();
    };
    return { themeService, panelService, panelComponent, service, component, testApp, created: sessions, dispose };
}

type Harness = ReturnType<typeof buildHarness>;

describe("TerminalPanelComponent", () => {
    let h: Harness;

    beforeEach(() => {
        h = buildHarness();
    });

    it("keeps the placeholder until the first open (lazy)", () => {
        expect(h.panelComponent.view.getChildren()).toEqual([]);
        h.testApp.render();
        expect(h.testApp.backend.screenToString()).toContain("No active terminal.");
        h.dispose();
    });

    it("builds a widget for the spawned session and injects it into the panel", () => {
        h.service.openTerminal();
        const content = h.panelComponent.view.getChildren();
        expect(content).toHaveLength(1);
        expect(content[0]).toBeInstanceOf(TerminalViewElement);
        h.dispose();
    });

    it("focuses the terminal widget on open", () => {
        h.service.openTerminal();
        h.testApp.render();
        const widget = h.panelComponent.view.getChildren()[0] as TerminalViewElement;
        expect(widget.isFocused).toBe(true);
        h.dispose();
    });

    it("re-focuses the active widget on focusActive; no-op without terminals", () => {
        // Ни одного инстанса — запрос фокуса не должен падать (activeWidget = null).
        expect(() => {
            h.service.focusActive();
        }).not.toThrow();

        h.service.openTerminal();
        h.testApp.render();
        const widget = h.panelComponent.view.getChildren()[0] as TerminalViewElement;
        widget.blur();
        h.testApp.render();
        expect(widget.isFocused).toBe(false);

        h.service.focusActive();
        h.testApp.render();
        expect(widget.isFocused).toBe(true);
        h.dispose();
    });

    it("disposes the widget and restores the placeholder when the shell exits", () => {
        h.service.openTerminal();
        expect(h.panelComponent.view.getChildren()).toHaveLength(1);
        const disposeSpy = vi.spyOn(TerminalViewElement.prototype, "dispose");

        h.created[0].emitExit(0);

        // Инстанс снят: виджет dispose'нут, контент вкладки снова null → placeholder.
        expect(disposeSpy).toHaveBeenCalledTimes(1);
        expect(h.panelComponent.view.getChildren()).toEqual([]);
        h.testApp.render();
        expect(h.testApp.backend.screenToString()).toContain("No active terminal.");
        disposeSpy.mockRestore();
        h.dispose();
    });

    it("shows the widget of a newly created second terminal", () => {
        h.service.openTerminal();
        const first = h.panelComponent.view.getChildren()[0];
        h.service.newTerminal();
        const second = h.panelComponent.view.getChildren()[0];
        expect(second).not.toBe(first);
        h.dispose();
    });

    it("falls back to the previous terminal's widget when the active one exits", () => {
        h.service.newTerminal(); // #1
        const firstWidget = h.panelComponent.view.getChildren()[0];
        h.service.newTerminal(); // #2 active

        h.created[1].emitExit(0);

        expect(h.panelComponent.view.getChildren()[0]).toBe(firstWidget);
        h.dispose();
    });

    it("keeps the active widget when a NON-active terminal exits", () => {
        h.service.newTerminal(); // #1
        h.service.newTerminal(); // #2 — активный
        const activeWidget = h.panelComponent.view.getChildren()[0];

        h.created[0].emitExit(0); // выходит НЕактивный #1

        expect(h.panelComponent.view.getChildren()[0]).toBe(activeWidget);
        h.dispose();
    });

    it("spawns, shows and focuses the terminal when its tab is clicked", () => {
        // Клик по табу: контрол зовёт onActivateView → PanelService.activateView →
        // TerminalService лениво спавнит шелл → компонент вкидывает и фокусирует виджет.
        h.panelComponent.view.setActiveView(TERMINAL_VIEW_ID);
        h.panelComponent.view.onActivateView?.(TERMINAL_VIEW_ID);

        const content = h.panelComponent.view.getChildren();
        expect(content).toHaveLength(1);
        expect(content[0]).toBeInstanceOf(TerminalViewElement);
        h.testApp.render();
        expect((content[0] as TerminalViewElement).isFocused).toBe(true);
        h.dispose();
    });

    it("adopts instances created before the component existed", () => {
        const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
        const panelService = new PanelService();
        const panelComponent = new PanelComponent(panelService, themeService);
        const service = new TerminalService(panelService, () => new FakeTerminalSurface());
        service.openTerminal(); // инстанс существует ДО компонента

        const component = new TerminalPanelComponent(service, panelService, themeService);

        expect(panelComponent.view.getChildren()).toHaveLength(1);
        expect(panelComponent.view.getChildren()[0]).toBeInstanceOf(TerminalViewElement);
        component.dispose();
        service.dispose();
        panelComponent.dispose();
    });

    it("disposes remaining widgets on component dispose", () => {
        h.service.newTerminal();
        h.service.newTerminal();
        const disposeSpy = vi.spyOn(TerminalViewElement.prototype, "dispose");
        h.component.dispose();
        expect(disposeSpy).toHaveBeenCalledTimes(2);
        disposeSpy.mockRestore();
        h.service.dispose();
    });
});

describe("TerminalPanelComponent — theme", () => {
    /**
     * Полноценная тема, из которой выброшены только terminal.* — так проверяются
     * фоллбэки `getColor("terminal.*") ?? getRequiredColor(panel/editor)`. Остальные
     * цвета оставляем дефолтными: их читает PanelComponent на том же onThemeChange.
     */
    function themeWithoutTerminalColors(): WorkbenchTheme {
        const base = WorkbenchTheme.fromThemeFile({ name: "no-terminal-colors", type: "dark", colors: {} });
        const colors = { ...base.colors };
        delete colors["terminal.background"];
        delete colors["terminal.foreground"];
        colors["panel.background"] = 0x111111;
        colors["editor.foreground"] = 0x222222;
        return new WorkbenchTheme("no-terminal-colors", "dark", colors, base.tokenTheme);
    }

    it("pushes terminal theme colors into each widget on creation", () => {
        const h = buildHarness();
        const setStyles = vi.spyOn(TerminalViewElement.prototype, "setStyles");
        h.service.openTerminal();
        // dark+ default: terminal.foreground #CCCCCC, terminal.background #181818.
        expect(setStyles).toHaveBeenCalledWith({ defaultFg: 0xcccccc, defaultBg: 0x181818 });
        setStyles.mockRestore();
        h.dispose();
    });

    it("re-applies colors to open widgets when the theme changes", () => {
        const h = buildHarness();
        h.service.openTerminal();
        const setStyles = vi.spyOn(TerminalViewElement.prototype, "setStyles");

        h.themeService.setTheme(themeWithoutTerminalColors());

        expect(setStyles).toHaveBeenCalledWith({ defaultBg: 0x111111, defaultFg: 0x222222 });
        setStyles.mockRestore();
        h.dispose();
    });

    it("falls back to panel/editor colors for terminals created under such a theme", () => {
        const h = buildHarness();
        h.themeService.setTheme(themeWithoutTerminalColors());
        const setStyles = vi.spyOn(TerminalViewElement.prototype, "setStyles");
        h.service.openTerminal();

        expect(setStyles).toHaveBeenCalledWith({ defaultBg: 0x111111, defaultFg: 0x222222 });
        setStyles.mockRestore();
        h.dispose();
    });
});
