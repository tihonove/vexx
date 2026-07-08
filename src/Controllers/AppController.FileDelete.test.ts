import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIMouseEvent } from "../TUIDom/Events/TUIMouseEvent.ts";
import { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

let savedXdg: string | undefined;

function createTempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-file-delete-integration-"));
    fs.writeFileSync(path.join(dir, "alpha.txt"), "Alpha content");
    fs.writeFileSync(path.join(dir, "beta.txt"), "Beta content");
    // Изолированная корзина под этот тест, чтобы удаление было обратимым и не трогало ~/.local.
    process.env.XDG_DATA_HOME = path.join(dir, ".xdg");
    return dir;
}

function cleanupDir(dirPath: string): void {
    fs.rmSync(dirPath, { recursive: true, force: true });
}

interface IntegrationContext {
    testApp: TestApp;
    controller: AppController;
    commands: CommandRegistry;
    tmpDir: string;
}

function createIntegrationApp(tmpDir: string, size = new Size(80, 24)): IntegrationContext {
    const { container, bindApp } = createTestContainer();
    const controller = container.get(AppControllerDIToken);
    controller.setWorkspaceFolder(tmpDir);
    controller.mount();
    const testApp = TestApp.create(controller.view, size);
    bindApp(testApp.app);
    return { testApp, controller, commands: container.get(CommandRegistryDIToken), tmpDir };
}

describe("fileOperations.deleteFile command", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;
    let commands: CommandRegistry;

    beforeEach(async () => {
        savedXdg = process.env.XDG_DATA_HOME;
        tmpDir = createTempWorkspace();
        ({ testApp, controller, commands } = createIntegrationApp(tmpDir));
        await controller.activate();
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        cleanupDir(tmpDir);
        if (savedXdg === undefined) delete process.env.XDG_DATA_HOME;
        else process.env.XDG_DATA_HOME = savedXdg;
    });

    // Удаление теперь спрашивает подтверждение; корзина доступна → дефолтная кнопка
    // ("Move to Trash") в фокусе, подтверждаем её Enter.
    function confirmDelete(): void {
        expect(testApp.querySelector("ConfirmDialogElement")).not.toBeNull();
        testApp.sendKey("Enter");
        testApp.render();
    }

    it("deletes the specified file after confirmation", () => {
        const filePath = path.join(tmpDir, "alpha.txt");
        expect(fs.existsSync(filePath)).toBe(true);

        commands.execute("fileOperations.deleteFile", filePath);
        testApp.render();
        confirmDelete();

        expect(fs.existsSync(filePath)).toBe(false);
    });

    it("asks for confirmation and does not delete until confirmed", () => {
        const filePath = path.join(tmpDir, "alpha.txt");

        commands.execute("fileOperations.deleteFile", filePath);
        testApp.render();

        // Dialog is up, file still on disk.
        expect(testApp.querySelector("ConfirmDialogElement")).not.toBeNull();
        expect(fs.existsSync(filePath)).toBe(true);
    });

    it("does not delete other files when deleting one", () => {
        const alpha = path.join(tmpDir, "alpha.txt");
        const beta = path.join(tmpDir, "beta.txt");

        commands.execute("fileOperations.deleteFile", alpha);
        testApp.render();
        confirmDelete();

        expect(fs.existsSync(alpha)).toBe(false);
        expect(fs.existsSync(beta)).toBe(true);
    });

    it("restores the file on undo (Ctrl+Z in the explorer)", async () => {
        const filePath = path.join(tmpDir, "alpha.txt");

        commands.execute("fileOperations.deleteFile", filePath);
        testApp.render();
        confirmDelete();
        expect(fs.existsSync(filePath)).toBe(false);

        await commands.execute("fileOperations.undo");
        testApp.render();

        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, "utf8")).toBe("Alpha content");
    });

    it("command is registered and executable without throwing", () => {
        const nonExistent = path.join(tmpDir, "ghost.txt");
        expect(() => commands.execute("fileOperations.deleteFile", nonExistent)).not.toThrow();
    });

    it("is a no-op when called without an argument and nothing is selected in the tree", () => {
        // No workspace folder → no tree → no selected node to fall back to.
        const { container, bindApp } = createTestContainer();
        const bareController = container.get(AppControllerDIToken);
        bareController.mount();
        const bareApp = TestApp.create(bareController.view, new Size(80, 24));
        bindApp(bareApp.app);
        const bareCommands = container.get(CommandRegistryDIToken);

        expect(() => bareCommands.execute("fileOperations.deleteFile")).not.toThrow();
        bareController.dispose();
    });
});

describe("Delete key in the file tree", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;

    beforeEach(async () => {
        savedXdg = process.env.XDG_DATA_HOME;
        tmpDir = createTempWorkspace();
        ({ testApp, controller } = createIntegrationApp(tmpDir));
        await controller.activate();
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        cleanupDir(tmpDir);
        if (savedXdg === undefined) delete process.env.XDG_DATA_HOME;
        else process.env.XDG_DATA_HOME = savedXdg;
    });

    function getTreeElement(): TreeViewElement<unknown> {
        const el = testApp.querySelector("TreeViewElement");
        expect(el).not.toBeNull();
        return el as TreeViewElement<unknown>;
    }

    function confirmDelete(): void {
        expect(testApp.querySelector("ConfirmDialogElement")).not.toBeNull();
        testApp.sendKey("Enter");
        testApp.render();
    }

    it("pressing Delete deletes the file selected in the focused tree after confirmation", () => {
        const alpha = path.join(tmpDir, "alpha.txt");
        const beta = path.join(tmpDir, "beta.txt");

        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        // Row 0 (alpha.txt) is selected by default.
        testApp.sendKey("Delete");
        testApp.render();
        expect(fs.existsSync(alpha)).toBe(true); // not deleted until confirmed
        confirmDelete();

        expect(fs.existsSync(alpha)).toBe(false);
        expect(fs.existsSync(beta)).toBe(true);
    });

    it("pressing Delete deletes the file the cursor was moved to", () => {
        const alpha = path.join(tmpDir, "alpha.txt");
        const beta = path.join(tmpDir, "beta.txt");

        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        testApp.sendKey("ArrowDown");
        testApp.sendKey("Delete");
        testApp.render();
        confirmDelete();

        expect(fs.existsSync(alpha)).toBe(true);
        expect(fs.existsSync(beta)).toBe(false);
    });

    it("does not delete tree files when the tree is not focused", () => {
        const alpha = path.join(tmpDir, "alpha.txt");

        controller.openFile(alpha);
        controller.focusEditor();
        testApp.render();

        testApp.sendKey("Delete");
        testApp.render();

        expect(testApp.querySelector("ConfirmDialogElement")).toBeNull();
        expect(fs.existsSync(alpha)).toBe(true);
    });
});

describe("File tree context menu — right-click opens context menu", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;

    beforeEach(async () => {
        savedXdg = process.env.XDG_DATA_HOME;
        tmpDir = createTempWorkspace();
        ({ testApp, controller } = createIntegrationApp(tmpDir));
        await controller.activate();
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        cleanupDir(tmpDir);
        if (savedXdg === undefined) delete process.env.XDG_DATA_HOME;
        else process.env.XDG_DATA_HOME = savedXdg;
    });

    function getTreeElement(): TreeViewElement<unknown> {
        const el = testApp.querySelector("TreeViewElement");
        expect(el).not.toBeNull();
        return el as TreeViewElement<unknown>;
    }

    function rightClickRow(tree: TreeViewElement<unknown>, row: number): void {
        tree.globalPosition = new Point(0, 0);
        tree.dispatchEvent(
            new TUIMouseEvent("click", { button: "right", screenX: 2, screenY: row, localX: 2, localY: row }),
        );
        testApp.render();
    }

    it("right-click on a file in the tree opens a context menu popup", () => {
        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        rightClickRow(tree, 0);

        expect(testApp.querySelector("PopupMenuElement")).not.toBeNull();
    });

    it("context menu contains a Delete entry", () => {
        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        rightClickRow(tree, 0);

        const items = testApp.querySelectorAll("PopupMenuItemElement");
        expect(items.length).toBeGreaterThan(0);
        expect(testApp.backend.screenToString()).toContain("Delete");
    });

    it("selecting Delete closes the menu and opens a confirmation, then deletes", () => {
        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        const alpha = path.join(tmpDir, "alpha.txt");
        rightClickRow(tree, 0);
        expect(testApp.querySelector("PopupMenuElement")).not.toBeNull();

        // Menu order is Copy, Cut, (separator), Copy Path, Copy Relative Path, (separator), Delete
        // — navigate down to Delete (separators are skipped) and activate it.
        testApp.sendKey("ArrowDown");
        testApp.sendKey("ArrowDown");
        testApp.sendKey("ArrowDown");
        testApp.sendKey("ArrowDown");
        testApp.sendKey("Enter");
        testApp.render();

        // Menu closed; confirmation dialog is up; file not yet deleted.
        expect(testApp.querySelector("PopupMenuElement")).toBeNull();
        expect(testApp.querySelector("ConfirmDialogElement")).not.toBeNull();
        expect(fs.existsSync(alpha)).toBe(true);

        testApp.sendKey("Enter"); // confirm "Move to Trash"
        testApp.render();
        expect(fs.existsSync(alpha)).toBe(false);
    });

    it("right-clicking a second file replaces the existing context menu", () => {
        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        rightClickRow(tree, 0);
        expect(testApp.querySelector("PopupMenuElement")).not.toBeNull();

        rightClickRow(tree, 1);
        expect(testApp.querySelectorAll("PopupMenuElement")).toHaveLength(1);
    });

    it("pressing Escape closes the context menu and returns focus to the tree", () => {
        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        rightClickRow(tree, 0);
        expect(testApp.querySelector("PopupMenuElement")).not.toBeNull();

        testApp.sendKey("Escape");
        testApp.render();

        expect(testApp.querySelector("PopupMenuElement")).toBeNull();
        expect(testApp.focusedElement).toBe(tree);
    });

    it("selecting a menu entry returns focus to the tree without activating the row", () => {
        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        rightClickRow(tree, 0);
        expect(testApp.focusedElement).not.toBe(tree); // фокус ушёл в меню

        testApp.sendKey("Enter"); // первый пункт — Copy
        testApp.render();

        expect(testApp.querySelector("PopupMenuElement")).toBeNull();
        // Фокус вернулся дереву, а парный keypress того же Enter не «протёк» в дерево
        // и не открыл файл под курсором в редакторе.
        expect(testApp.focusedElement).toBe(tree);
    });
});
