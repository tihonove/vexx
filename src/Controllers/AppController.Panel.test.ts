import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import type { PanelContainerElement } from "../TUIDom/Widgets/PanelContainerElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { ContextKeyService, ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";
import { PROBLEMS_VIEW_ID } from "./PanelController.ts";

const TOGGLE_PANEL = "workbench.action.togglePanel";
const TOGGLE_PROBLEMS = "workbench.actions.view.problems";

describe("AppController — bottom panel visibility commands", () => {
    let tmpDir: string;
    let controller: AppController;
    let commands: CommandRegistry;
    let contextKeys: ContextKeyService;
    let testApp: TestApp;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-panel-"));
        const { container, bindApp } = createTestContainer();
        controller = container.get(AppControllerDIToken);
        controller.setWorkspaceFolder(tmpDir);
        controller.mount();
        testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        commands = container.get(CommandRegistryDIToken);
        contextKeys = container.get(ContextKeyServiceDIToken);
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function panel(): PanelContainerElement {
        return controller.workbenchLayout.getBottomPanel() as PanelContainerElement;
    }

    it("mounts the Panel controller's view as the workbench bottom panel, hidden initially", () => {
        expect(panel().getViewIds()).toContain(PROBLEMS_VIEW_ID);
        expect(controller.workbenchLayout.getBottomPanelVisible()).toBe(false);
    });

    it("toggles panel visibility and keeps the context key in sync", () => {
        commands.execute(TOGGLE_PANEL);
        expect(controller.workbenchLayout.getBottomPanelVisible()).toBe(true);
        expect(contextKeys.get("panelVisible")).toBe(true);

        commands.execute(TOGGLE_PANEL);
        expect(controller.workbenchLayout.getBottomPanelVisible()).toBe(false);
        expect(contextKeys.get("panelVisible")).toBe(false);
    });

    it("Toggle Problems shows the panel with Problems active, then hides it", () => {
        commands.execute(TOGGLE_PROBLEMS);
        expect(controller.workbenchLayout.getBottomPanelVisible()).toBe(true);
        expect(panel().getActiveViewId()).toBe(PROBLEMS_VIEW_ID);

        // End-to-end: the panel actually paints its tab + empty-state on screen.
        testApp.render();
        const screen = testApp.backend.screenToString();
        expect(screen).toContain("PROBLEMS");
        expect(screen).toContain("No problems have been detected in the workspace.");

        // Problems already visible+active → the command hides the panel.
        commands.execute(TOGGLE_PROBLEMS);
        testApp.render();
        expect(controller.workbenchLayout.getBottomPanelVisible()).toBe(false);
        expect(testApp.backend.screenToString()).not.toContain("PROBLEMS");
    });

    it("Toggle Problems re-opens the panel when it was toggled off", () => {
        commands.execute(TOGGLE_PANEL); // open (Problems active by default)
        commands.execute(TOGGLE_PANEL); // close
        expect(controller.workbenchLayout.getBottomPanelVisible()).toBe(false);

        // Panel hidden → Toggle Problems opens it again rather than staying hidden.
        commands.execute(TOGGLE_PROBLEMS);
        expect(controller.workbenchLayout.getBottomPanelVisible()).toBe(true);
        expect(panel().getActiveViewId()).toBe(PROBLEMS_VIEW_ID);
    });
});
