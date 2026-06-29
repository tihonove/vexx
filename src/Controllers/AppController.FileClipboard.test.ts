import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

// Workspace layout (dirs sort first): row 0 = "target/", row 1 = "a.txt".
function createWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-fileclip-int-"));
    fs.mkdirSync(path.join(dir, "target"));
    fs.writeFileSync(path.join(dir, "a.txt"), "hello");
    return dir;
}

interface Ctx {
    testApp: TestApp;
    controller: AppController;
    commands: CommandRegistry;
}

function createApp(tmpDir: string): Ctx {
    const { container, bindApp } = createTestContainer();
    const controller = container.get(AppControllerDIToken);
    controller.setWorkspaceFolder(tmpDir);
    controller.mount();
    const testApp = TestApp.create(controller.view, new Size(80, 24));
    bindApp(testApp.app);
    return { testApp, controller, commands: container.get(CommandRegistryDIToken) };
}

describe("File explorer copy/cut/paste commands", () => {
    let tmpDir: string;
    let ctx: Ctx;

    beforeEach(async () => {
        tmpDir = createWorkspace();
        ctx = createApp(tmpDir);
        await ctx.controller.activate();
        ctx.testApp.render();
        ctx.testApp.querySelector("TreeViewElement")!.focus();
        ctx.testApp.render();
    });

    afterEach(() => {
        ctx.controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("copies a file into a folder, leaving the original", async () => {
        ctx.testApp.sendKey("ArrowDown"); // cursor on a.txt
        ctx.commands.execute("fileOperations.copy");
        ctx.testApp.sendKey("ArrowUp"); // cursor on target/
        ctx.commands.execute("fileOperations.paste");

        expect(fs.existsSync(path.join(tmpDir, "target", "a.txt"))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, "a.txt"))).toBe(true);
    });

    it("cuts a file into a folder, removing the original and clearing the clipboard", async () => {
        ctx.testApp.sendKey("ArrowDown"); // cursor on a.txt
        ctx.commands.execute("fileOperations.cut");
        ctx.testApp.sendKey("ArrowUp"); // cursor on target/
        ctx.commands.execute("fileOperations.paste");

        expect(fs.existsSync(path.join(tmpDir, "target", "a.txt"))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, "a.txt"))).toBe(false);

        // Pasting again is a no-op because the cut cleared the clipboard.
        ctx.commands.execute("fileOperations.paste");
        expect(fs.existsSync(path.join(tmpDir, "target", "a copy.txt"))).toBe(false);
    });

    it("auto-renames when pasting a copy alongside the original", async () => {
        ctx.testApp.sendKey("ArrowDown"); // cursor on a.txt
        ctx.commands.execute("fileOperations.copy");
        // cursor stays on a.txt → target dir is the workspace root, where a.txt already exists
        ctx.commands.execute("fileOperations.paste");

        expect(fs.existsSync(path.join(tmpDir, "a copy.txt"))).toBe(true);
    });
});
