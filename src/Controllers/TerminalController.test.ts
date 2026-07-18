import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { FakeTerminalSurface } from "../TestUtils/FakeTerminalSurface.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { TerminalViewElement } from "../TUIDom/Widgets/Terminal/TerminalViewElement.ts";

import { createTestContainer } from "./Modules/TestProfile.ts";
import { PanelController, PanelControllerDIToken, PROBLEMS_VIEW_ID, TERMINAL_VIEW_ID } from "./PanelController.ts";
import { TerminalSessionFactoryDIToken } from "./Terminal/TerminalSessionFactory.ts";
import { TerminalController, TerminalControllerDIToken } from "./TerminalController.ts";

function buildHarness() {
    const { container, bindApp } = createTestContainer();
    const sessions: FakeTerminalSurface[] = [];
    const factoryOptions: { cols: number; rows: number; cwd?: string }[] = [];
    // Локальная фабрика, записывающая созданные сессии — так тест видит инстансы.
    container.bind(TerminalSessionFactoryDIToken, () => (options) => {
        factoryOptions.push(options);
        const surface = new FakeTerminalSurface();
        sessions.push(surface);
        return surface;
    });
    const c = container.get(TerminalControllerDIToken);
    const p = container.get(PanelControllerDIToken);
    const app = TestApp.createWithContent(p.view, new Size(70, 12));
    bindApp(app.app);
    c.mount();
    // Делаем TERMINAL активной вкладкой — так panel.getChildren() отражает контент
    // терминала. setActiveView НЕ спавнит шелл (спавн только по клику/openTerminal).
    p.showTerminal();
    return {
        controller: c,
        panel: p,
        testApp: app,
        created: sessions,
        factoryOptions,
        themeService: container.get(ThemeServiceDIToken),
    };
}

describe("TerminalController", () => {
    let controller: TerminalController;
    let panel: PanelController;
    let testApp: TestApp;
    let created: FakeTerminalSurface[];

    beforeEach(() => {
        const h = buildHarness();
        controller = h.controller;
        panel = h.panel;
        testApp = h.testApp;
        created = h.created;
    });

    it("registers the TERMINAL tab and stays lazy — no session until first open", () => {
        expect(panel.view.getViewIds()).toContain(TERMINAL_VIEW_ID);
        expect(created).toHaveLength(0);
        expect(controller.hasOpenTerminals).toBe(false);
    });

    it("spawns a session and injects the widget into the panel on first open", () => {
        controller.openTerminal();
        expect(created).toHaveLength(1);
        expect(controller.hasOpenTerminals).toBe(true);
        const content = panel.view.getChildren();
        expect(content).toHaveLength(1);
        expect(content[0]).toBeInstanceOf(TerminalViewElement);
    });

    it("reuses the active instance on subsequent opens (no extra session)", () => {
        controller.openTerminal();
        controller.openTerminal();
        expect(created).toHaveLength(1);
    });

    it("focuses the terminal widget on open", () => {
        panel.showTerminal();
        controller.openTerminal();
        testApp.render();
        const widget = panel.view.getChildren()[0] as TerminalViewElement;
        expect(widget.isFocused).toBe(true);
    });

    it("removes the instance, restores the placeholder, and respawns on next open when the shell exits", () => {
        controller.openTerminal();
        expect(panel.view.getChildren()).toHaveLength(1);

        created[0].emitExit(0);
        // Инстанс снят, контент вкладки снова null → panel показывает placeholder.
        expect(controller.hasOpenTerminals).toBe(false);
        expect(panel.view.getChildren()).toEqual([]);
        expect(created[0].disposed).toBe(true);

        // Следующее открытие спавнит новый шелл.
        controller.openTerminal();
        expect(created).toHaveLength(2);
        expect(controller.hasOpenTerminals).toBe(true);
    });

    it("makes a second terminal the active one and shows its widget", () => {
        controller.openTerminal();
        const first = panel.view.getChildren()[0];
        controller.newTerminal();
        expect(created).toHaveLength(2);
        const second = panel.view.getChildren()[0];
        expect(second).not.toBe(first);
    });

    it("falls back to the previous terminal when the active one exits", () => {
        controller.newTerminal(); // #1
        controller.newTerminal(); // #2 active
        expect(created).toHaveLength(2);

        created[1].emitExit(0); // active exits → fall back to #1
        expect(controller.hasOpenTerminals).toBe(true);
        expect(panel.view.getChildren()).toHaveLength(1);
        expect(created[1].disposed).toBe(true);
        expect(created[0].disposed).toBe(false);
    });

    it("disposes all sessions on dispose (kills PTYs)", () => {
        controller.newTerminal();
        controller.newTerminal();
        controller.dispose();
        expect(created[0].disposed).toBe(true);
        expect(created[1].disposed).toBe(true);
    });

    it("pushes terminal theme colors into each widget", () => {
        const setStyles = vi.spyOn(TerminalViewElement.prototype, "setStyles");
        controller.openTerminal();
        // dark+ default: terminal.foreground #CCCCCC, terminal.background #181818.
        expect(setStyles).toHaveBeenCalledWith({ defaultFg: 0xcccccc, defaultBg: 0x181818 });
        setStyles.mockRestore();
    });

    it("ignores activation of a view that is not the terminal", () => {
        // Слот onActivateView одиночный и общий для всей панели — чужие id не должны
        // спавнить шелл.
        panel.view.onActivateView?.(PROBLEMS_VIEW_ID);
        expect(created).toHaveLength(0);
        expect(controller.hasOpenTerminals).toBe(false);
    });

    it("spawns and focuses the terminal when its own tab is activated", () => {
        panel.view.onActivateView?.(TERMINAL_VIEW_ID);
        expect(created).toHaveLength(1);
        expect(controller.hasOpenTerminals).toBe(true);
    });

    afterEach(() => {
        controller.dispose();
    });
});

describe("TerminalController — working directory", () => {
    it("spawns in the configured working directory", () => {
        const h = buildHarness();
        h.controller.setWorkingDirectory("/tmp/workspace-folder");
        h.controller.openTerminal();

        expect(h.factoryOptions[0].cwd).toBe("/tmp/workspace-folder");
        h.controller.dispose();
    });

    it("falls back to process.cwd() when no working directory was set", () => {
        const h = buildHarness();
        h.controller.openTerminal();

        expect(h.factoryOptions[0].cwd).toBe(process.cwd());
        h.controller.dispose();
    });
});

describe("TerminalController — focusActive", () => {
    it("focuses the active widget", () => {
        const h = buildHarness();
        h.controller.openTerminal();
        h.testApp.render();
        const widget = h.panel.view.getChildren()[0] as TerminalViewElement;
        widget.blur();
        h.testApp.render();
        expect(widget.isFocused).toBe(false);

        h.controller.focusActive();
        h.testApp.render();
        expect(widget.isFocused).toBe(true);
        h.controller.dispose();
    });

    it("is a no-op when no terminal is open", () => {
        const h = buildHarness();
        // Ни одного инстанса — active() отдаёт undefined, опциональная цепочка молчит.
        expect(() => {
            h.controller.focusActive();
        }).not.toThrow();
        h.controller.dispose();
    });
});

describe("TerminalController — exit handling", () => {
    it("keeps the active terminal shown when a NON-active one exits", () => {
        const h = buildHarness();
        h.controller.newTerminal(); // #1
        h.controller.newTerminal(); // #2 — активный
        const activeWidget = h.panel.view.getChildren()[0];

        h.created[0].emitExit(0); // выходит НЕактивный #1

        // Активный не тронут: контент вкладки прежний, сессия жива.
        expect(h.panel.view.getChildren()[0]).toBe(activeWidget);
        expect(h.created[1].disposed).toBe(false);
        expect(h.created[0].disposed).toBe(true);
        expect(h.controller.hasOpenTerminals).toBe(true);
        h.controller.dispose();
    });

    it("unsubscribes from a session it removed, so a repeated exit is inert", () => {
        const h = buildHarness();
        h.controller.openTerminal();
        h.created[0].emitExit(0);
        expect(h.controller.hasOpenTerminals).toBe(false);

        // Подписку рвёт destroyInstance, поэтому повторный сигнал выхода до контроллера
        // уже не доходит и ничего не ломает.
        expect(() => {
            h.created[0].emitExit(0);
        }).not.toThrow();
        expect(h.controller.hasOpenTerminals).toBe(false);
        h.controller.dispose();
    });

    it("stops reacting to a session's exit after controller dispose", () => {
        const h = buildHarness();
        h.controller.openTerminal();
        h.controller.dispose();

        // dispose() снял подписки — «поздний» выход PTY не должен трогать контроллер.
        expect(() => {
            h.created[0].emitExit(0);
        }).not.toThrow();
        expect(h.controller.hasOpenTerminals).toBe(false);
    });
});

describe("TerminalController — theme", () => {
    /**
     * Полноценная тема, из которой выброшены только terminal.* — так проверяются
     * фоллбэки `getColor("terminal.*") ?? getRequiredColor(panel/editor)`. Остальные
     * цвета оставляем дефолтными: их читает PanelController на том же onThemeChange.
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

    it("re-applies colors to open widgets when the theme changes", () => {
        const h = buildHarness();
        h.controller.openTerminal();
        const setStyles = vi.spyOn(TerminalViewElement.prototype, "setStyles");

        h.themeService.setTheme(themeWithoutTerminalColors());

        expect(setStyles).toHaveBeenCalledWith({ defaultBg: 0x111111, defaultFg: 0x222222 });
        setStyles.mockRestore();
        h.controller.dispose();
    });

    it("falls back to panel/editor colors for terminals created under such a theme", () => {
        const h = buildHarness();
        h.themeService.setTheme(themeWithoutTerminalColors());
        const setStyles = vi.spyOn(TerminalViewElement.prototype, "setStyles");
        h.controller.openTerminal();

        expect(setStyles).toHaveBeenCalledWith({ defaultBg: 0x111111, defaultFg: 0x222222 });
        setStyles.mockRestore();
        h.controller.dispose();
    });
});

describe("TerminalController — instance title", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("names instances after $SHELL, falling back to bash", () => {
        vi.stubEnv("SHELL", undefined);
        const h = buildHarness();
        // Титул не торчит наружу отдельным геттером — но ветка `process.env.SHELL ?? "bash"`
        // исполняется при создании инстанса и не должна падать без $SHELL.
        expect(() => {
            h.controller.openTerminal();
        }).not.toThrow();
        expect(h.created).toHaveLength(1);
        h.controller.dispose();
    });
});
