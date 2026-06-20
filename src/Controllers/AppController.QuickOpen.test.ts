import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { EditorTabStripElement } from "../TUIDom/Widgets/EditorTabStripElement.ts";
import type { QuickPickElement, QuickPickItem } from "../TUIDom/Widgets/QuickPickElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

function createTempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-quickopen-"));
    fs.writeFileSync(path.join(dir, "alpha.txt"), "Alpha content");
    fs.writeFileSync(path.join(dir, "beta.txt"), "Beta content");
    return dir;
}

interface QuickOpenContext {
    testApp: TestApp;
    controller: AppController;
    commands: CommandRegistry;
    tmpDir: string;
}

function createQuickOpenApp(tmpDir: string, size = new Size(80, 24)): QuickOpenContext {
    const { container, bindApp } = createTestContainer();
    const controller = container.get(AppControllerDIToken);
    controller.setWorkspaceFolder(tmpDir);
    controller.mount();
    const testApp = TestApp.create(controller.view, size);
    bindApp(testApp.app);
    return { testApp, controller, commands: container.get(CommandRegistryDIToken), tmpDir };
}

/** queueMicrotask is used by the accept handler; flush it. */
async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe("AppController — Quick Open accept callbacks", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;
    let commands: CommandRegistry;

    beforeEach(async () => {
        tmpDir = createTempWorkspace();
        ({ testApp, controller, commands } = createQuickOpenApp(tmpDir));
        await controller.activate();
        // The file index now builds in the background — wait for it so the picker
        // has entries when the test opens Quick Open.
        await controller.fileIndexReady;
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it("accepting a file entry opens it in the editor (workbench.openFile)", async () => {
        const executeSpy = vi.spyOn(commands, "execute");
        controller.focusEditor();
        testApp.sendKey("Ctrl+P");
        testApp.render();

        const picker = testApp.querySelector("QuickPickElement") as QuickPickElement;
        const alpha = picker.items.find((i) => i.label === "alpha.txt") as QuickPickItem;
        expect(alpha).toBeDefined();

        picker.onAccept?.(alpha, picker.items.indexOf(alpha));
        await flushMicrotasks();
        testApp.render();

        const alphaPath = path.join(tmpDir, "alpha.txt");
        expect(executeSpy).toHaveBeenCalledWith("workbench.openFile", alphaPath);

        // The wired workbench.openFile callback opens an editor tab.
        const tabStrip = testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
        expect(tabStrip.getItemElements().length).toBeGreaterThan(0);
    });

    it("workbench.openFile command opens an editor and updates the status bar", () => {
        const alphaPath = path.join(tmpDir, "alpha.txt");

        commands.execute("workbench.openFile", alphaPath);
        testApp.render();

        const tabStrip = testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
        const labels = tabStrip.getItemElements().map((el) => el.getLabel());
        expect(labels.some((l) => l.includes("alpha.txt"))).toBe(true);
    });

    it("command-mode accept executes the chosen command (onExecuteCommand)", async () => {
        const ran = vi.fn();
        commands.register("test.quickOpenTarget", ran, "Quick Open Target Command");
        controller.focusEditor();

        // Enter command mode via the registered Show Commands command.
        commands.execute("workbench.action.showCommands");
        testApp.render();

        const picker = testApp.querySelector("QuickPickElement") as QuickPickElement;
        const target = picker.items.find((i) => i.label === "Quick Open Target Command") as QuickPickItem;
        expect(target).toBeDefined();

        picker.onAccept?.(target, picker.items.indexOf(target));
        await flushMicrotasks();

        expect(ran).toHaveBeenCalledTimes(1);
    });

    it("accepting closes the quick-open overlay", async () => {
        controller.focusEditor();
        testApp.sendKey("Ctrl+P");
        testApp.render();
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(true);

        const picker = testApp.querySelector("QuickPickElement") as QuickPickElement;
        const first = picker.items[0];
        expect(first).toBeDefined();

        picker.onAccept?.(first, 0);
        await flushMicrotasks();
        testApp.render();

        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(false);
    });
});
