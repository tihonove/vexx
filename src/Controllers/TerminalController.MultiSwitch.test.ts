import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { FakeTerminalSurface } from "../TestUtils/FakeTerminalSurface.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TerminalViewElement } from "../TUIDom/Widgets/Terminal/TerminalViewElement.ts";

import { createTestContainer } from "./Modules/TestProfile.ts";
import { PanelControllerDIToken } from "./PanelController.ts";
import { TerminalSessionFactoryDIToken } from "./Terminal/TerminalSessionFactory.ts";
import { type TerminalRef, TerminalControllerDIToken } from "./TerminalController.ts";

function buildHarness() {
    const { container, bindApp } = createTestContainer();
    const sessions: FakeTerminalSurface[] = [];
    container.bind(TerminalSessionFactoryDIToken, () => () => {
        const surface = new FakeTerminalSurface();
        sessions.push(surface);
        return surface;
    });
    const controller = container.get(TerminalControllerDIToken);
    const panel = container.get(PanelControllerDIToken);
    const app = TestApp.createWithContent(panel.view, new Size(70, 12));
    bindApp(app.app);
    controller.mount();
    panel.showTerminal();
    return { controller, panel, created: sessions };
}

/** The active terminal widget currently shown inside the split pane. */
function activeWidget(controller: ReturnType<typeof buildHarness>["controller"]): TerminalViewElement | undefined {
    return controller.getPane()?.getChildren()[0] as TerminalViewElement | undefined;
}

describe("TerminalController — multi-terminal switching", () => {
    let h: ReturnType<typeof buildHarness>;

    beforeEach(() => {
        h = buildHarness();
    });

    afterEach(() => {
        h.controller.dispose();
    });

    it("exposes the terminal list and the active id", () => {
        expect(h.controller.getTerminals()).toEqual([]);
        expect(h.controller.activeTerminalId).toBeNull();
        expect(h.controller.getPane()).toBeNull();

        h.controller.newTerminal(); // #1
        h.controller.newTerminal(); // #2
        expect(h.controller.getTerminals()).toEqual([
            { id: 1, title: "bash (1)" },
            { id: 2, title: "bash (2)" },
        ]);
        expect(h.controller.activeTerminalId).toBe(2);
    });

    it("shows the list only when more than one terminal is open", () => {
        h.controller.openTerminal(); // #1
        expect(h.controller.getPane()?.isListVisible()).toBe(false);
        h.controller.newTerminal(); // #2
        expect(h.controller.getPane()?.isListVisible()).toBe(true);
        h.controller.killActive(); // back to #1
        expect(h.controller.getPane()?.isListVisible()).toBe(false);
    });

    it("switches the active terminal and its shown widget", () => {
        h.controller.newTerminal(); // #1
        h.controller.newTerminal(); // #2 (active)
        const second = activeWidget(h.controller);

        const changes: (TerminalRef | undefined)[] = [];
        h.controller.onDidChangeActiveTerminal((t) => changes.push(t));

        h.controller.setActiveTerminal(1);
        expect(h.controller.activeTerminalId).toBe(1);
        expect(activeWidget(h.controller)).not.toBe(second);
        expect(changes).toEqual([{ id: 1, title: "bash (1)" }]);

        h.controller.setActiveTerminal(999); // unknown → no-op
        expect(h.controller.activeTerminalId).toBe(1);
        expect(changes).toHaveLength(1);
    });

    it("routes the list's row callbacks to switch and kill", () => {
        h.controller.newTerminal(); // #1
        h.controller.newTerminal(); // #2
        const list = h.controller.getPane()!.list;

        list.onActivate?.(1);
        expect(h.controller.activeTerminalId).toBe(1);

        list.onClose?.(1);
        expect(h.controller.getTerminals().map((t) => t.id)).toEqual([2]);
    });

    it("fires open/close events with the terminal ref", () => {
        const opened: TerminalRef[] = [];
        const closed: TerminalRef[] = [];
        h.controller.onDidOpenTerminal((t) => opened.push(t));
        h.controller.onDidCloseTerminal((t) => closed.push(t));

        h.controller.newTerminal(); // #1
        h.controller.newTerminal(); // #2
        expect(opened).toEqual([{ id: 1, title: "bash (1)" }, { id: 2, title: "bash (2)" }]);

        h.controller.killTerminal(1);
        expect(closed).toEqual([{ id: 1, title: "bash (1)" }]);
        expect(h.created[0].disposed).toBe(true);
    });

    it("killActive falls back to the newest remaining terminal", () => {
        h.controller.newTerminal(); // #1
        h.controller.newTerminal(); // #2
        h.controller.newTerminal(); // #3 (active)

        h.controller.killActive(); // kills #3 → active becomes #2
        expect(h.controller.activeTerminalId).toBe(2);
        expect(h.controller.getTerminals().map((t) => t.id)).toEqual([1, 2]);
    });

    it("restores the placeholder when the last terminal is killed", () => {
        const changes: (TerminalRef | undefined)[] = [];
        h.controller.openTerminal(); // #1
        h.controller.onDidChangeActiveTerminal((t) => changes.push(t));

        h.controller.killActive();
        expect(h.controller.hasOpenTerminals).toBe(false);
        expect(h.controller.activeTerminalId).toBeNull();
        expect(h.panel.view.getChildren()).toEqual([]); // pane detached → placeholder
        expect(changes).toEqual([undefined]);
    });

    it("no-ops kill for an unknown id or with no terminals", () => {
        expect(() => h.controller.killActive()).not.toThrow();
        h.controller.openTerminal();
        expect(() => h.controller.killTerminal(999)).not.toThrow();
        expect(h.controller.hasOpenTerminals).toBe(true);
    });

    it("stops notifying a disposed listener (double-dispose is safe)", () => {
        const opened: TerminalRef[] = [];
        const sub = h.controller.onDidOpenTerminal((t) => opened.push(t));
        h.controller.newTerminal(); // #1
        sub.dispose();
        sub.dispose(); // already removed → no-op
        h.controller.newTerminal(); // #2 — listener gone
        expect(opened).toEqual([{ id: 1, title: "bash (1)" }]);
    });

    it("kills a background instance created without ever showing the pane", () => {
        h.controller.createInstance(); // #1 — no show, pane stays null
        h.controller.createInstance(); // #2
        expect(h.controller.getPane()).toBeNull();

        h.controller.killTerminal(1);
        expect(h.controller.getTerminals().map((t) => t.id)).toEqual([2]);
        expect(h.controller.getPane()).toBeNull();
    });
});
