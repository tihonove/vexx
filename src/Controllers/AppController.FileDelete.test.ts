import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { Point } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIMouseEvent } from "../TUIDom/Events/TUIMouseEvent.ts";
import { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

function createTempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-file-delete-integration-"));
    fs.writeFileSync(path.join(dir, "alpha.txt"), "Alpha content");
    fs.writeFileSync(path.join(dir, "beta.txt"), "Beta content");
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
        tmpDir = createTempWorkspace();
        ({ testApp, controller, commands } = createIntegrationApp(tmpDir));
        await controller.activate();
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        cleanupDir(tmpDir);
    });

    it("deletes the specified file from disk", () => {
        const filePath = path.join(tmpDir, "alpha.txt");
        expect(fs.existsSync(filePath)).toBe(true);

        commands.execute("fileOperations.deleteFile", filePath);

        expect(fs.existsSync(filePath)).toBe(false);
    });

    it("does not delete other files when deleting one", () => {
        const alpha = path.join(tmpDir, "alpha.txt");
        const beta = path.join(tmpDir, "beta.txt");

        commands.execute("fileOperations.deleteFile", alpha);

        expect(fs.existsSync(alpha)).toBe(false);
        expect(fs.existsSync(beta)).toBe(true);
    });

    it("command is registered and executable without throwing", () => {
        const nonExistent = path.join(tmpDir, "ghost.txt");
        expect(() => commands.execute("fileOperations.deleteFile", nonExistent)).not.toThrow();
    });
});

describe("File tree context menu — right-click opens context menu", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;

    beforeEach(async () => {
        tmpDir = createTempWorkspace();
        ({ testApp, controller } = createIntegrationApp(tmpDir));
        await controller.activate();
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        cleanupDir(tmpDir);
    });

    function getTreeElement(): TreeViewElement<unknown> {
        const el = testApp.querySelector("TreeViewElement");
        expect(el).not.toBeNull();
        return el as TreeViewElement<unknown>;
    }

    it("right-click on a file in the tree opens a context menu popup", () => {
        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        // Right-click on first row (row 0 = alpha.txt)
        tree.globalPosition = new Point(0, 0);
        const event = new TUIMouseEvent("click", {
            button: "right",
            screenX: 2,
            screenY: 0,
            localX: 2,
            localY: 0,
        });
        tree.dispatchEvent(event);
        testApp.render();

        const popup = testApp.querySelector("PopupMenuElement");
        expect(popup).not.toBeNull();
    });

    it("context menu contains a Delete entry", () => {
        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        tree.globalPosition = new Point(0, 0);
        const event = new TUIMouseEvent("click", {
            button: "right",
            screenX: 2,
            screenY: 0,
            localX: 2,
            localY: 0,
        });
        tree.dispatchEvent(event);
        testApp.render();

        const popup = testApp.querySelector("PopupMenuElement");
        expect(popup).not.toBeNull();

        const items = testApp.querySelectorAll("PopupMenuItemElement");
        // At least one item should be present; check it renders Delete
        expect(items.length).toBeGreaterThan(0);
        // The rendered popup should have a Delete label item visible on screen
        const screen = testApp.backend.screenToString();
        expect(screen).toContain("Delete");
    });

    it("selecting Delete runs the delete command and closes the menu", () => {
        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        const alpha = path.join(tmpDir, "alpha.txt");
        expect(fs.existsSync(alpha)).toBe(true);

        // Right-click row 0 (alpha.txt) to open the context menu.
        tree.globalPosition = new Point(0, 0);
        tree.dispatchEvent(
            new TUIMouseEvent("click", { button: "right", screenX: 2, screenY: 0, localX: 2, localY: 0 }),
        );
        testApp.render();
        expect(testApp.querySelector("PopupMenuElement")).not.toBeNull();

        // The only entry ("Delete") is preselected; Enter activates it.
        testApp.sendKey("Enter");
        testApp.render();

        // onSelect deleted the file and tore the popup session down.
        expect(fs.existsSync(alpha)).toBe(false);
        expect(testApp.querySelector("PopupMenuElement")).toBeNull();
    });

    it("right-clicking a second file replaces the existing context menu", () => {
        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        const openMenuAt = (row: number): void => {
            tree.globalPosition = new Point(0, 0);
            tree.dispatchEvent(
                new TUIMouseEvent("click", { button: "right", screenX: 2, screenY: row, localX: 2, localY: row }),
            );
            testApp.render();
        };

        // First right-click opens a menu for row 0…
        openMenuAt(0);
        expect(testApp.querySelector("PopupMenuElement")).not.toBeNull();

        // …a second right-click first hides the previous session, then opens a fresh one.
        openMenuAt(1);
        expect(testApp.querySelectorAll("PopupMenuElement")).toHaveLength(1);
    });

    it("pressing Escape closes the context menu", () => {
        const tree = getTreeElement();
        tree.focus();
        testApp.render();

        tree.globalPosition = new Point(0, 0);
        const event = new TUIMouseEvent("click", {
            button: "right",
            screenX: 2,
            screenY: 0,
            localX: 2,
            localY: 0,
        });
        tree.dispatchEvent(event);
        testApp.render();

        expect(testApp.querySelector("PopupMenuElement")).not.toBeNull();

        testApp.sendKey("Escape");
        testApp.render();

        expect(testApp.querySelector("PopupMenuElement")).toBeNull();
    });
});
