import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import type { ConfirmDialogElement } from "../TUIDom/Widgets/ConfirmDialogElement.tsx";
import { EditorTabStripElement } from "../TUIDom/Widgets/EditorTabStripElement.ts";
import type { QuickPickElement } from "../TUIDom/Widgets/QuickPickElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

function createTempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-saveas-"));
    fs.writeFileSync(path.join(dir, "alpha.txt"), "Alpha content");
    fs.writeFileSync(path.join(dir, "beta.txt"), "Beta content");
    return dir;
}

/** The Save As handler awaits the QuickInput promise; flush the continuation. */
async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

/** The visible Save As InputBox is the QuickPickElement carrying a seeded query. */
function openInputBox(testApp: TestApp): QuickPickElement {
    const pickers = testApp.querySelectorAll("QuickPickElement") as QuickPickElement[];
    const input = pickers.find((p) => p.getQuery().length > 0);
    if (!input) throw new Error("Save As input box not found");
    return input;
}

describe("AppController — Save As", () => {
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

    it("seeds the input with the current file path", () => {
        const filePath = path.join(tmpDir, "alpha.txt");
        commands.execute("workbench.openFile", filePath);
        testApp.render();

        commands.execute("workbench.action.files.saveAs");
        testApp.render();

        expect(openInputBox(testApp).getQuery()).toBe(filePath);
    });

    it("saves the active editor to a new path and renames the tab", async () => {
        const filePath = path.join(tmpDir, "alpha.txt");
        commands.execute("workbench.openFile", filePath);
        testApp.render();

        commands.execute("workbench.action.files.saveAs");
        testApp.render();

        const newPath = path.join(tmpDir, "renamed.md");
        openInputBox(testApp).setQuery(newPath);
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        expect(fs.readFileSync(newPath, "utf-8")).toBe("Alpha content");

        const tabStrip = testApp.querySelector("EditorTabStripElement") as EditorTabStripElement;
        const labels = tabStrip.getItemElements().map((el) => el.getLabel());
        expect(labels.some((l) => l.includes("renamed.md"))).toBe(true);
    });

    it("prompts before overwriting a different existing file", async () => {
        commands.execute("workbench.openFile", path.join(tmpDir, "alpha.txt"));
        testApp.render();
        commands.execute("workbench.action.files.saveAs");
        testApp.render();

        const betaPath = path.join(tmpDir, "beta.txt");
        openInputBox(testApp).setQuery(betaPath);
        testApp.sendKey("Enter");
        await flushMicrotasks();
        testApp.render();

        // A confirm dialog appears and beta.txt is NOT overwritten yet.
        const dialog = testApp.querySelector("ConfirmDialogElement") as ConfirmDialogElement | null;
        expect(dialog).not.toBeNull();
        expect(fs.readFileSync(betaPath, "utf-8")).toBe("Beta content");

        dialog!.onConfirm?.();
        testApp.render();

        expect(fs.readFileSync(betaPath, "utf-8")).toBe("Alpha content");
    });

    it("validates the target path", () => {
        commands.execute("workbench.openFile", path.join(tmpDir, "alpha.txt"));
        testApp.render();
        commands.execute("workbench.action.files.saveAs");
        testApp.render();

        const input = openInputBox(testApp);

        input.onQueryChange?.("   ");
        expect(input.validationMessage).toBe("Please enter a file name");

        const missingDir = path.join(tmpDir, "no", "such", "dir", "file.txt");
        input.onQueryChange?.(missingDir);
        expect(input.validationMessage).toContain("Directory does not exist");

        // The workspace directory itself is a folder, not a valid file target.
        input.onQueryChange?.(tmpDir);
        expect(input.validationMessage).toBe("A folder with that name already exists");

        input.onQueryChange?.(path.join(tmpDir, "fresh.txt"));
        expect(input.validationMessage).toBeNull();
    });

    it("does nothing when there is no active editor", () => {
        // No file opened → no active editor → the command is a no-op (no prompt shown).
        commands.execute("workbench.action.files.saveAs");
        testApp.render();

        const anySeeded = (testApp.querySelectorAll("QuickPickElement") as QuickPickElement[]).some(
            (p) => p.getQuery().length > 0,
        );
        expect(anySeeded).toBe(false);
    });

    it("Escape cancels without writing anything", async () => {
        commands.execute("workbench.openFile", path.join(tmpDir, "alpha.txt"));
        testApp.render();
        commands.execute("workbench.action.files.saveAs");
        testApp.render();

        const newPath = path.join(tmpDir, "should-not-exist.txt");
        openInputBox(testApp).setQuery(newPath);
        testApp.sendKey("Escape");
        await flushMicrotasks();
        testApp.render();

        expect(fs.existsSync(newPath)).toBe(false);
        expect(testApp.root.overlayLayer.hasVisibleItems()).toBe(false);
    });
});
