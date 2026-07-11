import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { EditorTabStripElement } from "../TUIDom/Widgets/EditorTabStripElement.ts";
import type { QuickPickElement } from "../TUIDom/Widgets/QuickPickElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

function createTempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-open-"));
    fs.writeFileSync(path.join(dir, "alpha.txt"), "Alpha content");
    fs.writeFileSync(path.join(dir, "beta.txt"), "Beta content");
    return dir;
}

/** The open prompt awaits the QuickInput promise; flush the microtask continuation. */
async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

/** The visible open prompt is the QuickPickElement carrying the given title. */
function openInputBox(testApp: TestApp, title: string): QuickPickElement {
    const pickers = testApp.querySelectorAll("QuickPickElement") as QuickPickElement[];
    const input = pickers.find((p) => p.title === title);
    if (!input) throw new Error(`open prompt "${title}" not found`);
    return input;
}

function tabLabels(testApp: TestApp): string[] {
    const tabStrip = testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
    return tabStrip.getItemElements().map((el) => el.getLabel());
}

describe("AppController — Open File / Open Folder", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;
    let commands: CommandRegistry;

    beforeEach(() => {
        tmpDir = createTempWorkspace();
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

    it("opens the Open File prompt empty (no scary seed error)", () => {
        commands.execute("workbench.action.files.openFile");
        testApp.render();

        const input = openInputBox(testApp, "Open File");
        expect(input.getQuery()).toBe("");
        expect(input.validationMessage).toBeNull();
    });

    it("opens the entered absolute path in a new tab", async () => {
        commands.execute("workbench.action.files.openFile");
        testApp.render();

        const input = openInputBox(testApp, "Open File");
        input.onQueryChange?.(path.join(tmpDir, "beta.txt"));
        input.setQuery(path.join(tmpDir, "beta.txt"));
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(tabLabels(testApp).some((l) => l.includes("beta.txt"))).toBe(true);
    });

    it("resolves a relative path against the workspace root", async () => {
        commands.execute("workbench.action.files.openFile");
        testApp.render();

        const input = openInputBox(testApp, "Open File");
        // A bare name is valid because it resolves against the workspace root.
        input.onQueryChange?.("beta.txt");
        expect(input.validationMessage).toBeNull();

        input.setQuery("beta.txt");
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(tabLabels(testApp).some((l) => l.includes("beta.txt"))).toBe(true);
    });

    it("validates the Open File path", () => {
        commands.execute("workbench.action.files.openFile");
        testApp.render();
        const input = openInputBox(testApp, "Open File");

        // Empty input is not flagged as an error (Enter is a harmless no-op).
        input.onQueryChange?.("   ");
        expect(input.validationMessage).toBeNull();

        input.onQueryChange?.(path.join(tmpDir, "nope.txt"));
        expect(input.validationMessage).toContain("File does not exist");

        // The workspace directory itself is a folder, not a file.
        input.onQueryChange?.(tmpDir);
        expect(input.validationMessage).toBe("That is a folder, not a file");

        input.onQueryChange?.(path.join(tmpDir, "alpha.txt"));
        expect(input.validationMessage).toBeNull();
    });

    it("Escape cancels Open File without opening anything", async () => {
        commands.execute("workbench.action.files.openFile");
        testApp.render();

        const input = openInputBox(testApp, "Open File");
        input.onQueryChange?.(path.join(tmpDir, "beta.txt"));
        input.setQuery(path.join(tmpDir, "beta.txt"));
        testApp.sendKey("Escape");
        await flushMicrotasks();
        testApp.render();

        expect(tabLabels(testApp).some((l) => l.includes("beta.txt"))).toBe(false);
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("swaps the workspace root to the entered folder", async () => {
        const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-open-other-"));
        fs.writeFileSync(path.join(otherDir, "gamma.txt"), "Gamma content");
        try {
            commands.execute("workbench.action.files.openFolder");
            testApp.render();

            const folderInput = openInputBox(testApp, "Open Folder");
            folderInput.onQueryChange?.(otherDir);
            folderInput.setQuery(otherDir);
            testApp.sendKey("Enter");
            await flushMicrotasks();
            testApp.render();

            // Observable effect: relative Open File paths now resolve against the new
            // root — gamma.txt exists only there, not in the original workspace.
            commands.execute("workbench.action.files.openFile");
            testApp.render();
            const fileInput = openInputBox(testApp, "Open File");
            fileInput.onQueryChange?.("gamma.txt");
            expect(fileInput.validationMessage).toBeNull();
        } finally {
            fs.rmSync(otherDir, { recursive: true, force: true });
        }
    });

    it("accepting an empty Open File prompt opens nothing and closes", async () => {
        commands.execute("workbench.action.files.openFile");
        testApp.render();

        // Empty is a valid (non-error) value, so Enter is accepted but is a no-op.
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(tabLabels(testApp).some((l) => l.includes(".txt"))).toBe(false);
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(false);
    });

    it("Ctrl+O opens the Open File prompt", () => {
        testApp.sendKey("Ctrl+O");
        testApp.render();

        expect(() => openInputBox(testApp, "Open File")).not.toThrow();
    });

    it("Ctrl+K Ctrl+O opens the Open Folder prompt", () => {
        testApp.sendKey("Ctrl+K");
        testApp.sendKey("Ctrl+O");
        testApp.render();

        expect(() => openInputBox(testApp, "Open Folder")).not.toThrow();
    });

    it("validates the Open Folder path", () => {
        commands.execute("workbench.action.files.openFolder");
        testApp.render();
        const input = openInputBox(testApp, "Open Folder");

        input.onQueryChange?.(path.join(tmpDir, "no-such-dir"));
        expect(input.validationMessage).toContain("Folder does not exist");

        // An existing file is not a valid folder target.
        input.onQueryChange?.(path.join(tmpDir, "alpha.txt"));
        expect(input.validationMessage).toBe("That is a file, not a folder");

        input.onQueryChange?.(tmpDir);
        expect(input.validationMessage).toBeNull();
    });

    it("expands a leading ~ to the home directory", () => {
        commands.execute("workbench.action.files.openFile");
        testApp.render();
        const input = openInputBox(testApp, "Open File");

        input.onQueryChange?.("~/definitely-nonexistent-xyz");
        expect(input.validationMessage).toBe(`File does not exist: ${path.join(os.homedir(), "definitely-nonexistent-xyz")}`);
    });

    it("Escape cancels Open Folder without swapping the root", async () => {
        const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-open-cancel-"));
        try {
            commands.execute("workbench.action.files.openFolder");
            testApp.render();

            const folderInput = openInputBox(testApp, "Open Folder");
            folderInput.onQueryChange?.(otherDir);
            folderInput.setQuery(otherDir);
            testApp.sendKey("Escape");
            await flushMicrotasks();
            testApp.render();

            expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(false);
            // Root unchanged: a tmpDir-relative file still resolves.
            commands.execute("workbench.action.files.openFile");
            testApp.render();
            const fileInput = openInputBox(testApp, "Open File");
            fileInput.onQueryChange?.("beta.txt");
            expect(fileInput.validationMessage).toBeNull();
        } finally {
            fs.rmSync(otherDir, { recursive: true, force: true });
        }
    });

    it("accepting an empty Open Folder prompt swaps nothing and closes", async () => {
        commands.execute("workbench.action.files.openFolder");
        testApp.render();

        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(false);
        // Root unchanged: a tmpDir-relative file still resolves.
        commands.execute("workbench.action.files.openFile");
        testApp.render();
        const fileInput = openInputBox(testApp, "Open File");
        fileInput.onQueryChange?.("beta.txt");
        expect(fileInput.validationMessage).toBeNull();
    });
});

describe("AppController — Open File without a workspace folder", () => {
    it("resolves relative paths against the process cwd", () => {
        const { container, bindApp } = createTestContainer();
        const controller = container.get(AppControllerDIToken);
        // No setWorkspaceFolder(): getRootPath() is null → cwd fallback.
        controller.mount();
        const testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        const commands = container.get(CommandRegistryDIToken);
        try {
            commands.execute("workbench.action.files.openFile");
            testApp.render();
            const input = openInputBox(testApp, "Open File");

            input.onQueryChange?.("definitely-nonexistent-xyz.txt");
            expect(input.validationMessage).toBe(
                `File does not exist: ${path.join(process.cwd(), "definitely-nonexistent-xyz.txt")}`,
            );
        } finally {
            controller.dispose();
        }
    });
});
