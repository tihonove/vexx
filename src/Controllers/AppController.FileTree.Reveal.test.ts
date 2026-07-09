import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import type { IConfigurationService } from "../Configuration/IConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../Configuration/IConfigurationServiceDIToken.ts";
import { NULL_CONFIGURATION_SERVICE } from "../Configuration/NullConfigurationService.ts";
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

/** Конфиг-стаб: заданные ключи возвращают свои значения, остальные — default. */
function stubConfig(values: Record<string, unknown>): IConfigurationService {
    return {
        ...NULL_CONFIGURATION_SERVICE,
        get<T>(key: string, defaultValue?: T): T | undefined {
            if (key in values) return values[key] as T;
            return defaultValue;
        },
    };
}

interface Ctx {
    testApp: TestApp;
    controller: AppController;
    commands: CommandRegistry;
}

function createApp(workspaceDir: string, config?: IConfigurationService): Ctx {
    const { container, bindApp } = createTestContainer();
    if (config) {
        container.bind(IConfigurationServiceDIToken, () => config);
    }
    const controller = container.get(AppControllerDIToken);
    controller.setWorkspaceFolder(workspaceDir);
    controller.mount();
    const testApp = TestApp.create(controller.view, new Size(80, 24));
    bindApp(testApp.app);
    return { testApp, controller, commands: container.get(CommandRegistryDIToken) };
}

// The reveal is scheduled fire-and-forget (void promise); let its microtasks settle.
function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 20));
}

describe("reveal active file in explorer", () => {
    let tmpDir: string;
    let nestedFile: string;

    beforeEach(() => {
        tmpDir = createNestedWorkspace();
        nestedFile = path.join(tmpDir, "src", "deep", "target.ts");
    });

    afterEach(() => {
        cleanupDir(tmpDir);
    });

    it("auto-reveals the active file in the tree when the editor changes", async () => {
        const ctx = createApp(tmpDir);
        await ctx.controller.activate();
        ctx.testApp.render();

        // Nested file is inside a collapsed directory — not visible yet.
        expect(ctx.testApp.backend.screenToString()).not.toContain("target.ts");

        // Open it via a non-tree path (e.g. Quick Open). autoReveal defaults to true.
        ctx.controller.openFile(nestedFile);
        await flush();
        ctx.testApp.render();

        expect(ctx.testApp.backend.screenToString()).toContain("deep");
        ctx.controller.dispose();
    });

    it("treats a missing explorer.autoReveal setting as enabled", async () => {
        // A config whose get() always yields undefined exercises the `?? true` fallback.
        const ctx = createApp(tmpDir, { ...NULL_CONFIGURATION_SERVICE, get: () => undefined });
        await ctx.controller.activate();
        ctx.testApp.render();

        ctx.controller.openFile(nestedFile);
        await flush();
        ctx.testApp.render();

        expect(ctx.testApp.backend.screenToString()).toContain("deep");
        ctx.controller.dispose();
    });

    it("does not auto-reveal when explorer.autoReveal is false", async () => {
        const ctx = createApp(tmpDir, stubConfig({ "explorer.autoReveal": false }));
        await ctx.controller.activate();
        ctx.testApp.render();

        ctx.controller.openFile(nestedFile);
        await flush();
        ctx.testApp.render();

        // Directory stays collapsed — the ancestor dir is never expanded in the tree.
        // (the editor tab shows the file name, so assert on the tree-only "deep" dir instead)
        expect(ctx.testApp.backend.screenToString()).not.toContain("deep");
        ctx.controller.dispose();
    });

    it("reveal command shows the sidebar, focuses the tree, and reveals the active file", async () => {
        const ctx = createApp(tmpDir);
        await ctx.controller.activate();
        ctx.testApp.render();

        ctx.controller.openFile(nestedFile);
        await flush();

        // Hide the sidebar and move focus into the editor.
        ctx.testApp.sendKey("Ctrl+B");
        ctx.testApp.render();
        expect(ctx.controller.workbenchLayout.getLeftPanelVisible()).toBe(false);

        ctx.commands.execute("workbench.files.action.showActiveFileInExplorer");
        await flush();
        ctx.testApp.render();

        expect(ctx.controller.workbenchLayout.getLeftPanelVisible()).toBe(true);
        expect(ctx.testApp.focusedElement?.constructor.name).toBe("TreeViewElement");
        expect(ctx.testApp.backend.screenToString()).toContain("deep");
        ctx.controller.dispose();
    });

    it("reveal command is a no-op when there is no active editor", async () => {
        const ctx = createApp(tmpDir);
        await ctx.controller.activate();
        ctx.testApp.render();

        const editorGroup = (ctx.controller as unknown as { editorGroupController: EditorGroupController })
            .editorGroupController;
        expect(editorGroup.getActiveEditor()).toBeNull();
        expect(() => ctx.commands.execute("workbench.files.action.showActiveFileInExplorer")).not.toThrow();
        // Sidebar stays as-is (visible by default), nothing is revealed.
        expect(ctx.controller.workbenchLayout.getLeftPanelVisible()).toBe(true);
        ctx.controller.dispose();
    });
});
