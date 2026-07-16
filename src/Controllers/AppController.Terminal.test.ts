import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAppTestHarness, type IAppHarness } from "../TestUtils/AppTestHarness.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import type { PanelContainerElement } from "../TUIDom/Widgets/PanelContainerElement.ts";

import { ContextKeyService, ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import { TERMINAL_VIEW_ID } from "./PanelController.ts";
import { TerminalController, TerminalControllerDIToken } from "./TerminalController.ts";

const TOGGLE_TERMINAL = "workbench.action.terminal.toggleTerminal";
const NEW_TERMINAL = "workbench.action.terminal.new";
const KILL_TERMINAL = "workbench.action.terminal.kill";
const FOCUS_NEXT = "workbench.action.terminal.focusNext";
const FOCUS_PREV = "workbench.action.terminal.focusPrevious";

describe("AppController — integrated terminal", () => {
    let ws: ITempWorkspace;
    let h: IAppHarness;
    let contextKeys: ContextKeyService;
    let terminal: TerminalController;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-terminal-" });
        h = createAppTestHarness({ workspaceFolder: ws.dir });
        contextKeys = h.container.get(ContextKeyServiceDIToken);
        terminal = h.container.get(TerminalControllerDIToken);
    });

    afterEach(() => {
        h.dispose();
        ws.dispose();
    });

    function panel(): PanelContainerElement {
        return h.controller.workbenchLayout.getBottomPanel() as PanelContainerElement;
    }

    it("Toggle Terminal shows the panel with TERMINAL active and spawns/focuses a terminal", () => {
        h.commands.execute(TOGGLE_TERMINAL);

        expect(h.controller.workbenchLayout.getBottomPanelVisible()).toBe(true);
        expect(panel().getActiveViewId()).toBe(TERMINAL_VIEW_ID);
        expect(terminal.hasOpenTerminals).toBe(true);

        h.testApp.render();
        const screen = h.testApp.backend.screenToString();
        expect(screen).toContain("TERMINAL");

        // Focus landed on the terminal widget → the context keys reflect it.
        expect(contextKeys.get("terminalFocus")).toBe(true);
        expect(contextKeys.get("terminalIsOpen")).toBe(true);
    });

    it("Toggle Terminal again hides the panel", () => {
        h.commands.execute(TOGGLE_TERMINAL); // show
        h.commands.execute(TOGGLE_TERMINAL); // hide (Terminal already visible+active)

        expect(h.controller.workbenchLayout.getBottomPanelVisible()).toBe(false);
        h.testApp.render();
        expect(h.testApp.backend.screenToString()).not.toContain("TERMINAL");
        // The shell keeps running while the panel is only hidden.
        expect(contextKeys.get("terminalIsOpen")).toBe(true);
    });

    it("terminalIsOpen tracks whether a terminal is open", () => {
        expect(terminal.hasOpenTerminals).toBe(false);
        h.commands.execute(TOGGLE_TERMINAL);
        expect(contextKeys.get("terminalIsOpen")).toBe(true);
    });

    it("Create New Terminal opens a second instance", () => {
        h.commands.execute(TOGGLE_TERMINAL); // first terminal
        // The panel content is a stable split pane; the shown terminal is its active child.
        const activeWidget = () => terminal.getPane()?.getChildren()[0];
        const firstWidget = activeWidget();

        h.commands.execute(NEW_TERMINAL); // second terminal becomes active
        expect(panel().getActiveViewId()).toBe(TERMINAL_VIEW_ID);
        expect(terminal.hasOpenTerminals).toBe(true);
        const secondWidget = activeWidget();
        expect(secondWidget).not.toBe(firstWidget);
    });

    it("registers a New/Kill toolbar on the TERMINAL view, with Kill enabled only when open", () => {
        const kill = () => panel().getViewActions(TERMINAL_VIEW_ID).find((a) => a.commandId === KILL_TERMINAL);
        const newAction = panel().getViewActions(TERMINAL_VIEW_ID).find((a) => a.commandId === NEW_TERMINAL);

        expect(newAction).toBeDefined();
        expect(newAction?.icon).toBe("+");
        expect(kill()?.enabled).toBe(false); // nothing open yet

        h.commands.execute(TOGGLE_TERMINAL); // opens a terminal
        expect(kill()?.enabled).toBe(true);

        h.commands.execute(KILL_TERMINAL); // kills it → toolbar rebuilt
        expect(terminal.hasOpenTerminals).toBe(false);
        expect(kill()?.enabled).toBe(false);
    });

    it("the New toolbar action creates a terminal via its command", () => {
        const newAction = panel().getViewActions(TERMINAL_VIEW_ID).find((a) => a.commandId === NEW_TERMINAL);
        newAction?.run();
        expect(terminal.hasOpenTerminals).toBe(true);
    });

    it("focusNext / focusPrevious cycle the active terminal", () => {
        h.commands.execute(TOGGLE_TERMINAL); // #1
        h.commands.execute(NEW_TERMINAL); // #2
        h.commands.execute(NEW_TERMINAL); // #3 (active)
        expect(terminal.activeTerminalId).toBe(3);

        h.commands.execute(FOCUS_NEXT); // 3 → wraps to 1
        expect(terminal.activeTerminalId).toBe(1);
        h.commands.execute(FOCUS_PREV); // 1 → wraps to 3
        expect(terminal.activeTerminalId).toBe(3);
    });

    it("focusNext is a no-op when no terminal is open", () => {
        expect(() => h.commands.execute(FOCUS_NEXT)).not.toThrow();
        expect(terminal.hasOpenTerminals).toBe(false);
    });

    it("activating the TERMINAL tab lazily spawns a shell", () => {
        expect(terminal.hasOpenTerminals).toBe(false);

        // Simulate a click on the TERMINAL tab: the panel switches the active view,
        // then fires onActivateView (claimed by TerminalController.mount()).
        panel().setActiveView(TERMINAL_VIEW_ID);
        panel().onActivateView?.(TERMINAL_VIEW_ID);

        expect(terminal.hasOpenTerminals).toBe(true);
        expect(panel().getChildren()).toHaveLength(1);
    });
});
