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

let savedXdg: string | undefined;

function createWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-wsundo-scen-"));
    fs.mkdirSync(path.join(dir, "target"));
    fs.writeFileSync(path.join(dir, "a.txt"), "AAA");
    fs.writeFileSync(path.join(dir, "b.txt"), "BBB");
    fs.writeFileSync(path.join(dir, "doc.txt"), "");
    // Изолированная корзина под этот тест — удаление обратимо и не трогает ~/.local.
    process.env.XDG_DATA_HOME = path.join(dir, ".xdg");
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

function activeEditorText(controller: AppController): string {
    const group = (controller as unknown as { editorGroupController: EditorGroupController }).editorGroupController;
    return group.getActiveEditor()?.getText() ?? "";
}

describe("Explorer undo/redo scenarios", () => {
    let tmpDir: string;
    let ctx: Ctx;

    beforeEach(async () => {
        savedXdg = process.env.XDG_DATA_HOME;
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
        if (savedXdg === undefined) delete process.env.XDG_DATA_HOME;
        else process.env.XDG_DATA_HOME = savedXdg;
    });

    // Удаление в корзину доступно → дефолтная кнопка ("Move to Trash") в фокусе, подтверждаем Enter.
    function confirmDelete(): void {
        ctx.testApp.render();
        expect(ctx.testApp.querySelector("ConfirmDialogElement")).not.toBeNull();
        ctx.testApp.sendKey("Enter");
        ctx.testApp.render();
    }

    it("delete then undo restores the file", async () => {
        const a = path.join(tmpDir, "a.txt");
        ctx.commands.execute("fileOperations.deleteFile", a);
        confirmDelete();
        expect(fs.existsSync(a)).toBe(false);

        ctx.commands.execute("fileOperations.undo");
        await flush();
        expect(fs.readFileSync(a, "utf8")).toBe("AAA");
    });

    it("two deletes undo in LIFO order", async () => {
        const a = path.join(tmpDir, "a.txt");
        const b = path.join(tmpDir, "b.txt");
        ctx.commands.execute("fileOperations.deleteFile", a);
        confirmDelete();
        ctx.commands.execute("fileOperations.deleteFile", b);
        confirmDelete();

        ctx.commands.execute("fileOperations.undo");
        await flush();
        expect(fs.existsSync(b)).toBe(true); // последний удалённый восстановлен первым
        expect(fs.existsSync(a)).toBe(false);

        ctx.commands.execute("fileOperations.undo");
        await flush();
        expect(fs.existsSync(a)).toBe(true);
    });

    it("redo re-deletes after an undo", async () => {
        const a = path.join(tmpDir, "a.txt");
        ctx.commands.execute("fileOperations.deleteFile", a);
        confirmDelete();

        ctx.commands.execute("fileOperations.undo");
        await flush();
        expect(fs.existsSync(a)).toBe(true);

        ctx.commands.execute("fileOperations.redo");
        await flush();
        expect(fs.existsSync(a)).toBe(false);
    });

    it("editor and file-operation undo stacks are independent (VS Code model)", async () => {
        const a = path.join(tmpDir, "a.txt");
        const doc = path.join(tmpDir, "doc.txt");

        // Файловая операция в дереве (cut+paste = move, без диалога), фокус в дереве.
        // Дерево: target/(0), a.txt(1), b.txt(2), doc.txt(3).
        ctx.testApp.sendKey("ArrowDown"); // a.txt
        ctx.commands.execute("fileOperations.cut");
        ctx.testApp.sendKey("ArrowUp"); // target/
        ctx.commands.execute("fileOperations.paste");
        expect(fs.existsSync(a)).toBe(false);
        expect(fs.existsSync(path.join(tmpDir, "target", "a.txt"))).toBe(true);

        // Правка текста в редакторе (отдельный стек по пути файла).
        ctx.commands.execute("workbench.openFile", doc);
        ctx.testApp.render();
        ctx.testApp.sendKey("x");
        ctx.testApp.render();
        expect(activeEditorText(ctx.controller)).toContain("x");

        // Отмена в редакторе откатывает ТЕКСТ, файловую операцию не трогает.
        ctx.commands.execute("undo");
        ctx.testApp.render();
        expect(activeEditorText(ctx.controller)).not.toContain("x");
        expect(fs.existsSync(a)).toBe(false); // move ещё в силе

        // Отмена файловой операции откатывает MOVE, текста не касается.
        ctx.commands.execute("fileOperations.undo");
        await flush();
        expect(fs.existsSync(a)).toBe(true);
        expect(activeEditorText(ctx.controller)).not.toContain("x");
    });
});
