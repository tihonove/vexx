import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import type { EditorGroupController } from "./EditorGroupController.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

function createNestedWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-reveal-int-"));
    fs.mkdirSync(path.join(dir, "src", "deep"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "deep", "target.ts"), "export const x = 1;");
    fs.writeFileSync(path.join(dir, "README.md"), "# Readme");
    return dir;
}

function cleanupDir(dirPath: string): void {
    fs.rmSync(dirPath, { recursive: true, force: true });
}

// The reveal is scheduled fire-and-forget (void promise); let its microtasks settle.
function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 20));
}

describe("reveal active file in explorer", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;
    let commands: CommandRegistry;
    let nestedFile: string;

    beforeEach(async () => {
        tmpDir = createNestedWorkspace();
        nestedFile = path.join(tmpDir, "src", "deep", "target.ts");

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
        cleanupDir(tmpDir);
    });

    it("auto-reveals the active file in the tree when the editor changes", async () => {
        // Nested file is inside a collapsed directory — not visible yet.
        expect(testApp.backend.screenToString()).not.toContain("target.ts");

        // Open it via a non-tree path (e.g. Quick Open). autoReveal defaults to true.
        controller.openFile(nestedFile);
        await flush();
        testApp.render();

        expect(testApp.backend.screenToString()).toContain("target.ts");
    });

    it("reveal command shows the sidebar, focuses the tree, and reveals the active file", async () => {
        controller.openFile(nestedFile);
        await flush();

        // Hide the sidebar and move focus into the editor.
        testApp.sendKey("Ctrl+B");
        testApp.render();
        expect(controller.workbenchLayout.getLeftPanelVisible()).toBe(false);

        commands.execute("workbench.files.action.showActiveFileInExplorer");
        await flush();
        testApp.render();

        expect(controller.workbenchLayout.getLeftPanelVisible()).toBe(true);
        expect(testApp.focusedElement?.constructor.name).toBe("TreeViewElement");
        expect(testApp.backend.screenToString()).toContain("target.ts");
    });

    it("reveal command is a no-op when there is no active editor", () => {
        const editorGroup = (controller as unknown as { editorGroupController: EditorGroupController })
            .editorGroupController;
        expect(editorGroup.getActiveEditor()).toBeNull();
        expect(() => commands.execute("workbench.files.action.showActiveFileInExplorer")).not.toThrow();
        // Sidebar stays as-is (visible by default), nothing is revealed.
        expect(controller.workbenchLayout.getLeftPanelVisible()).toBe(true);
    });
});
