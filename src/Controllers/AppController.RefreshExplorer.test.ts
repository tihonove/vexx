import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIMouseEvent } from "../TUIDom/Events/TUIMouseEvent.ts";
import type { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

describe("AppController — Refresh Explorer", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;
    let commands: CommandRegistry;

    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-refresh-"));
        fs.writeFileSync(path.join(tmpDir, "hello.txt"), "hi");

        const { container, bindApp } = createTestContainer();
        controller = container.get(AppControllerDIToken);
        controller.setWorkspaceFolder(tmpDir);
        controller.mount();
        testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        commands = container.get(CommandRegistryDIToken);

        await controller.activate();
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("re-reads the directory so a newly added file becomes visible", async () => {
        // A file created outside the app after the tree was loaded is invisible
        // until the explorer is refreshed.
        expect(testApp.backend.screenToString()).not.toContain("aaa-new.txt");

        fs.writeFileSync(path.join(tmpDir, "aaa-new.txt"), "new");

        commands.execute("workbench.files.action.refreshFilesExplorer");
        await flushMicrotasks();
        testApp.render();

        expect(testApp.backend.screenToString()).toContain("aaa-new.txt");
    });

    it("is reachable from the file tree context menu", async () => {
        const tree = testApp.querySelector("TreeViewElement") as TreeViewElement<unknown>;
        tree.focus();
        testApp.render();

        // Right-click the first row to open the context menu.
        tree.globalPosition = new Point(0, 0);
        tree.dispatchEvent(
            new TUIMouseEvent("click", { button: "right", screenX: 2, screenY: 0, localX: 2, localY: 0 }),
        );
        testApp.render();
        expect(testApp.querySelector("PopupMenuElement")).not.toBeNull();

        fs.writeFileSync(path.join(tmpDir, "aaa-new.txt"), "new");

        // Menu order (no clipboard): Copy, Cut, Copy Path, Copy Relative Path,
        // Delete, Refresh Explorer (separators skipped) — 5 steps down, then Enter.
        for (let i = 0; i < 5; i++) testApp.sendKey("ArrowDown");
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(testApp.querySelector("PopupMenuElement")).toBeNull();
        expect(testApp.backend.screenToString()).toContain("aaa-new.txt");
    });
});
