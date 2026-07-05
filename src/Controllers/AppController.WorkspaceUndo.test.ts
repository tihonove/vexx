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

// Дерево: dirs-first → row 0 = "target/", row 1 = "a.txt".
function createWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-wsundo-"));
    fs.mkdirSync(path.join(dir, "target"));
    fs.writeFileSync(path.join(dir, "a.txt"), "hello");
    return dir;
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

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

describe("Explorer undo/redo of file operations", () => {
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

    it("undo of a cut+paste moves the file back (no confirmation)", async () => {
        ctx.testApp.sendKey("ArrowDown"); // a.txt
        ctx.commands.execute("fileOperations.cut");
        ctx.testApp.sendKey("ArrowUp"); // target/
        ctx.commands.execute("fileOperations.paste");
        expect(fs.existsSync(path.join(tmpDir, "target", "a.txt"))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, "a.txt"))).toBe(false);

        ctx.commands.execute("fileOperations.undo");
        await flush();

        // Move undo is not destructive → no dialog, file is back at its original place.
        expect(ctx.testApp.querySelector("ConfirmDialogElement")).toBeNull();
        expect(fs.existsSync(path.join(tmpDir, "a.txt"))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, "target", "a.txt"))).toBe(false);
    });

    it("undo of a copy+paste asks for confirmation, then deletes the created copy", async () => {
        ctx.testApp.sendKey("ArrowDown"); // a.txt
        ctx.commands.execute("fileOperations.copy");
        ctx.testApp.sendKey("ArrowUp"); // target/
        ctx.commands.execute("fileOperations.paste");
        const copy = path.join(tmpDir, "target", "a.txt");
        expect(fs.existsSync(copy)).toBe(true);

        ctx.commands.execute("fileOperations.undo");
        ctx.testApp.render();

        // Destructive undo → confirmation dialog; copy still there until confirmed.
        expect(ctx.testApp.querySelector("ConfirmDialogElement")).not.toBeNull();
        expect(fs.existsSync(copy)).toBe(true);

        ctx.testApp.sendKey("ArrowLeft"); // focus the confirm ("Yes") button
        ctx.testApp.sendKey("Enter");
        await flush();

        expect(fs.existsSync(copy)).toBe(false);
        expect(fs.existsSync(path.join(tmpDir, "a.txt"))).toBe(true); // original untouched
    });

    it("redo re-applies a move after undo", async () => {
        ctx.testApp.sendKey("ArrowDown"); // a.txt
        ctx.commands.execute("fileOperations.cut");
        ctx.testApp.sendKey("ArrowUp"); // target/
        ctx.commands.execute("fileOperations.paste");

        ctx.commands.execute("fileOperations.undo");
        await flush();
        expect(fs.existsSync(path.join(tmpDir, "a.txt"))).toBe(true);

        ctx.commands.execute("fileOperations.redo");
        await flush();
        expect(fs.existsSync(path.join(tmpDir, "target", "a.txt"))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, "a.txt"))).toBe(false);
    });
});
