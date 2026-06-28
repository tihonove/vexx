import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import type { WorkbenchLayoutElement } from "../TUIDom/Widgets/WorkbenchLayoutElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

describe("Side Bar width commands", () => {
    let tmpDir: string;
    let controller: AppController;
    let commands: CommandRegistry;
    let testApp: TestApp;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-sidebar-"));
        fs.writeFileSync(path.join(tmpDir, "hello.txt"), "hello world");

        const { container, bindApp } = createTestContainer();
        controller = container.get(AppControllerDIToken);
        controller.setWorkspaceFolder(tmpDir);
        controller.mount();

        testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        testApp.render();

        commands = container.get(CommandRegistryDIToken);
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function layout(): WorkbenchLayoutElement {
        const el = testApp.querySelector("WorkbenchLayoutElement");
        expect(el).not.toBeNull();
        return el as WorkbenchLayoutElement;
    }

    it("increase grows the sidebar by the step", () => {
        const before = layout().getLeftPanelWidth();
        commands.execute("workbench.action.increaseSidebarWidth");
        expect(layout().getLeftPanelWidth()).toBe(before + 3);
    });

    it("decrease shrinks the sidebar by the step", () => {
        const before = layout().getLeftPanelWidth();
        commands.execute("workbench.action.decreaseSidebarWidth");
        expect(layout().getLeftPanelWidth()).toBe(before - 3);
    });

    it("reset restores the default width", () => {
        commands.execute("workbench.action.increaseSidebarWidth");
        commands.execute("workbench.action.increaseSidebarWidth");
        commands.execute("workbench.action.resetSidebarWidth");
        expect(layout().getLeftPanelWidth()).toBe(30);
    });

    it("decrease clamps at the minimum width", () => {
        for (let i = 0; i < 20; i++) {
            commands.execute("workbench.action.decreaseSidebarWidth");
        }
        expect(layout().getLeftPanelWidth()).toBe(12);
    });
});
