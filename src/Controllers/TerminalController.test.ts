import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { FakeTerminalSurface } from "../TestUtils/FakeTerminalSurface.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TerminalViewElement } from "../TUIDom/Widgets/Terminal/TerminalViewElement.ts";

import { createTestContainer } from "./Modules/TestProfile.ts";
import { PanelController, PanelControllerDIToken, TERMINAL_VIEW_ID } from "./PanelController.ts";
import { TerminalSessionFactoryDIToken } from "./Terminal/TerminalSessionFactory.ts";
import { TerminalController, TerminalControllerDIToken } from "./TerminalController.ts";

describe("TerminalController", () => {
    let controller: TerminalController;
    let panel: PanelController;
    let testApp: TestApp;
    let created: FakeTerminalSurface[];

    function buildHarness() {
        const { container, bindApp } = createTestContainer();
        const sessions: FakeTerminalSurface[] = [];
        // Локальная фабрика, записывающая созданные сессии — так тест видит инстансы.
        container.bind(TerminalSessionFactoryDIToken, () => () => {
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
        return { controller: c, panel: p, testApp: app, created: sessions };
    }

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
        controller.openTerminal();
        const widget = panel.view.getChildren()[0] as TerminalViewElement;
        // dark+ default: terminal.foreground #CCCCCC, terminal.background #181818.
        expect(widget.defaultFg).toBe(0xcccccc);
        expect(widget.defaultBg).toBe(0x181818);
    });

    afterEach(() => {
        controller.dispose();
    });
});
