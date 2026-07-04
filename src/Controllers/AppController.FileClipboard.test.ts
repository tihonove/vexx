import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIMouseEvent } from "../TUIDom/Events/TUIMouseEvent.ts";
import type { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";

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

describe("File explorer context menu — clipboard entries", () => {
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

    // Порядок пунктов: Copy, Cut, [Paste — если буфер не пуст], (separator), Delete.
    function rightClickRow(row: number): void {
        clickTree(row, "right");
    }

    function clickRow(row: number): void {
        clickTree(row, "left");
    }

    function clickTree(row: number, button: "left" | "right"): void {
        const tree = ctx.testApp.querySelector("TreeViewElement") as TreeViewElement<unknown>;
        tree.globalPosition = new Point(0, 0);
        tree.dispatchEvent(new TUIMouseEvent("click", { button, screenX: 2, screenY: row, localX: 2, localY: row }));
        ctx.testApp.render();
    }

    it("Copy entry puts the clicked file on the clipboard", () => {
        rightClickRow(1); // a.txt
        ctx.testApp.sendKey("Enter"); // первый пункт — Copy
        ctx.testApp.render();
        expect(ctx.testApp.querySelector("PopupMenuElement")).toBeNull();

        // Курсор остался на a.txt → вставка в корень с авто-переименованием.
        ctx.commands.execute("fileOperations.paste");
        expect(fs.existsSync(path.join(tmpDir, "a copy.txt"))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, "a.txt"))).toBe(true);
    });

    it("Cut entry moves the file on the next paste", () => {
        rightClickRow(1); // a.txt
        ctx.testApp.sendKey("ArrowDown"); // Cut
        ctx.testApp.sendKey("Enter");
        ctx.testApp.render();

        // Фокус вернулся на дерево после закрытия меню — стрелка двигает курсор на target/.
        ctx.testApp.sendKey("ArrowUp");
        ctx.commands.execute("fileOperations.paste");

        expect(fs.existsSync(path.join(tmpDir, "target", "a.txt"))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, "a.txt"))).toBe(false);
    });

    it("Paste entry appears for a non-empty clipboard and pastes into the clicked folder", () => {
        ctx.testApp.sendKey("ArrowDown"); // a.txt
        ctx.commands.execute("fileOperations.copy");

        rightClickRow(0); // target/
        expect(ctx.testApp.backend.screenToString()).toContain("Paste");
        ctx.testApp.sendKey("ArrowDown"); // Cut
        ctx.testApp.sendKey("ArrowDown"); // Paste
        ctx.testApp.sendKey("Enter");
        ctx.testApp.render();

        expect(fs.existsSync(path.join(tmpDir, "target", "a.txt"))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, "a.txt"))).toBe(true);
    });
});
