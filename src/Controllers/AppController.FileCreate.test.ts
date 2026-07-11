import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIMouseEvent } from "../TUIDom/Events/TUIMouseEvent.ts";
import { EditorTabStripElement } from "../TUIDom/Widgets/EditorTabStripElement.ts";
import { QuickPickElement } from "../TUIDom/Widgets/QuickPickElement.ts";
import { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

/**
 * The create/Save-As handlers await the QuickInput promise and then several more
 * awaits (refresh → reveal → open); flush enough microtask turns to drain them.
 */
async function flushMicrotasks(): Promise<void> {
    for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** Find the QuickInput InputBox by its overlay title (create prompts start empty). */
function inputBox(testApp: TestApp, title: string): QuickPickElement {
    const pickers = testApp.querySelectorAll("QuickPickElement") as QuickPickElement[];
    const input = pickers.find((p) => p.title === title);
    if (!input) throw new Error(`Input box titled "${title}" not found`);
    return input;
}

/** Simulate typing into an InputBox: set the value AND revalidate (setQuery alone doesn't). */
function typeInto(input: QuickPickElement, text: string): void {
    input.setQuery(text);
    input.onQueryChange?.(text);
}

function tabLabels(testApp: TestApp): string[] {
    const strip = testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
    return strip.getItemElements().map((el) => el.getLabel());
}

describe("AppController — New File / New Folder", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;
    let commands: CommandRegistry;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-create-"));
        const { container, bindApp } = createTestContainer();
        controller = container.get(AppControllerDIToken);
        controller.setWorkspaceFolder(tmpDir);
        controller.mount();
        testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        commands = container.get(CommandRegistryDIToken);
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates a file, reveals it, and opens it in the editor", async () => {
        commands.execute("explorer.newFile", tmpDir);
        testApp.render();

        typeInto(inputBox(testApp, "New File"), "hello.ts");
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        const created = path.join(tmpDir, "hello.ts");
        expect(fs.readFileSync(created, "utf-8")).toBe("");
        expect(tabLabels(testApp).some((l) => l.includes("hello.ts"))).toBe(true);
    });

    it("creates a file next to a clicked file (target is the file's parent dir)", async () => {
        const clicked = path.join(tmpDir, "alpha.txt");
        fs.writeFileSync(clicked, "x");
        commands.execute("explorer.newFile", clicked);
        testApp.render();

        typeInto(inputBox(testApp, "New File"), "beside.ts");
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(fs.existsSync(path.join(tmpDir, "beside.ts"))).toBe(true);
    });

    it("falls back to the tree's paste-target dir when invoked without a path", async () => {
        commands.execute("explorer.newFile"); // no explorer path → getPasteTargetDir() (root)
        testApp.render();

        typeInto(inputBox(testApp, "New File"), "from-palette.ts");
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(fs.existsSync(path.join(tmpDir, "from-palette.ts"))).toBe(true);
    });

    it("creates a folder without opening an editor", async () => {
        commands.execute("explorer.newFolder", tmpDir);
        testApp.render();

        typeInto(inputBox(testApp, "New Folder"), "assets");
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(fs.statSync(path.join(tmpDir, "assets")).isDirectory()).toBe(true);
        expect(tabLabels(testApp)).toEqual([]);
    });

    it("creates intermediate directories for a nested file name", async () => {
        commands.execute("explorer.newFile", tmpDir);
        testApp.render();

        typeInto(inputBox(testApp, "New File"), path.join("sub", "dir", "note.md"));
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(fs.existsSync(path.join(tmpDir, "sub", "dir", "note.md"))).toBe(true);
    });

    it("validates the name", () => {
        fs.writeFileSync(path.join(tmpDir, "taken.txt"), "x");
        commands.execute("explorer.newFile", tmpDir);
        testApp.render();
        const input = inputBox(testApp, "New File");

        input.onQueryChange?.("   ");
        expect(input.validationMessage).toBe("Please enter a name");

        input.onQueryChange?.("..");
        expect(input.validationMessage).toBe("Invalid name");

        input.onQueryChange?.(path.join(os.tmpdir(), "abs.txt"));
        expect(input.validationMessage).toBe("Please enter a relative name");

        input.onQueryChange?.("taken.txt");
        expect(input.validationMessage).toBe("A file or folder with that name already exists");

        input.onQueryChange?.("fresh.txt");
        expect(input.validationMessage).toBeNull();
    });

    it("Escape cancels without creating anything", async () => {
        commands.execute("explorer.newFile", tmpDir);
        testApp.render();

        typeInto(inputBox(testApp, "New File"), "ghost.txt");
        testApp.sendKey("Escape");
        await flushMicrotasks();
        testApp.render();

        expect(fs.existsSync(path.join(tmpDir, "ghost.txt"))).toBe(false);
    });
});

describe("AppController — New Untitled File", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;
    let commands: CommandRegistry;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-untitled-"));
        const { container, bindApp } = createTestContainer();
        controller = container.get(AppControllerDIToken);
        controller.setWorkspaceFolder(tmpDir);
        controller.mount();
        testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        commands = container.get(CommandRegistryDIToken);
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("opens an Untitled-1 tab", () => {
        commands.execute("workbench.action.files.newUntitledFile");
        testApp.render();
        expect(tabLabels(testApp)).toEqual(["Untitled-1"]);
    });

    it("routes Save on an untitled buffer into Save As and writes the chosen path", async () => {
        commands.execute("workbench.action.files.newUntitledFile");
        testApp.render();

        commands.execute("workbench.action.files.save");
        await flushMicrotasks();
        testApp.render();

        // No path yet → runSave falls through to Save As, which pops its InputBox.
        const saveAs = (testApp.querySelectorAll("QuickPickElement") as QuickPickElement[]).find(
            (p) => p.title === "Save As",
        );
        expect(saveAs).toBeDefined();

        // Complete the Save As so runSave's no-file branch returns.
        const target = path.join(tmpDir, "saved-untitled.txt");
        saveAs!.setQuery(target);
        saveAs!.onQueryChange?.(target);
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(fs.existsSync(target)).toBe(true);
        expect(tabLabels(testApp)).toContain("saved-untitled.txt");
    });
});

describe("AppController — create via context menu", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;

    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-create-menu-"));
        fs.writeFileSync(path.join(tmpDir, "alpha.txt"), "a");
        const { container, bindApp } = createTestContainer();
        controller = container.get(AppControllerDIToken);
        controller.setWorkspaceFolder(tmpDir);
        controller.mount();
        testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        await controller.activate();
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function openMenuOnRoot(): void {
        const tree = testApp.querySelector("TreeViewElement") as TreeViewElement<unknown>;
        tree.focus();
        testApp.render();
        tree.globalPosition = new Point(0, 0);
        tree.dispatchEvent(
            new TUIMouseEvent("click", { button: "right", screenX: 2, screenY: 0, localX: 2, localY: 0 }),
        );
        testApp.render();
    }

    it("New File... entry prompts and creates a file", async () => {
        openMenuOnRoot();
        testApp.sendKey("Enter"); // first entry: New File...
        testApp.render();

        typeInto(inputBox(testApp, "New File"), "menu-file.ts");
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(fs.existsSync(path.join(tmpDir, "menu-file.ts"))).toBe(true);
    });

    it("no-ops when there is no target directory (no workspace, no path)", () => {
        const { container, bindApp } = createTestContainer();
        const c = container.get(AppControllerDIToken);
        c.mount(); // deliberately NOT setWorkspaceFolder → getPasteTargetDir() is null
        const app = TestApp.create(c.view, new Size(80, 24));
        bindApp(app.app);
        const cmds = container.get(CommandRegistryDIToken);

        cmds.execute("explorer.newFile"); // no path + no workspace → targetDir null → early return
        app.render();

        const hasPrompt = (app.querySelectorAll("QuickPickElement") as QuickPickElement[]).some(
            (p) => p.title === "New File",
        );
        expect(hasPrompt).toBe(false);
        c.dispose();
    });

    it("New Folder... entry prompts and creates a folder", async () => {
        openMenuOnRoot();
        testApp.sendKey("ArrowDown"); // second entry: New Folder...
        testApp.sendKey("Enter");
        testApp.render();

        typeInto(inputBox(testApp, "New Folder"), "menu-folder");
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(fs.statSync(path.join(tmpDir, "menu-folder")).isDirectory()).toBe(true);
    });
});
