import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import type { ConfirmDialogElement } from "../TUIDom/Widgets/ConfirmDialogElement.tsx";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

/** save() resolves the conflict check on a microtask; flush the runSave continuation. */
async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

describe("AppController — save conflict (dirty-write protection)", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;
    let commands: CommandRegistry;
    let filePath: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-saveconflict-"));
        filePath = path.join(tmpDir, "doc.txt");
        fs.writeFileSync(filePath, "original\n", "utf-8");

        const { container, bindApp } = createTestContainer();
        controller = container.get(AppControllerDIToken);
        controller.setWorkspaceFolder(tmpDir);
        controller.mount();
        testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        commands = container.get(CommandRegistryDIToken);

        commands.execute("workbench.openFile", filePath);
        testApp.render();
        // Make the buffer dirty (editor is focused after openFile).
        testApp.sendKey("X");
        testApp.render();
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function dialog(): ConfirmDialogElement | null {
        return testApp.querySelector("ConfirmDialogElement") as ConfirmDialogElement | null;
    }

    it("prompts to overwrite when the file changed on disk, leaving it untouched", async () => {
        fs.writeFileSync(filePath, "external edit\n", "utf-8");

        commands.execute("workbench.action.files.save");
        await flushMicrotasks();
        testApp.render();

        expect(dialog()).not.toBeNull();
        // The parallel change is preserved until the user decides.
        expect(fs.readFileSync(filePath, "utf-8")).toBe("external edit\n");
    });

    it("writes the buffer over the disk version once the user confirms", async () => {
        fs.writeFileSync(filePath, "external edit\n", "utf-8");

        commands.execute("workbench.action.files.save");
        await flushMicrotasks();
        testApp.render();

        dialog()!.onConfirm?.();
        await flushMicrotasks();
        testApp.render();

        const written = fs.readFileSync(filePath, "utf-8");
        expect(written).not.toBe("external edit\n");
        expect(written).toContain("X");
    });

    it("keeps the disk version when the user cancels", async () => {
        fs.writeFileSync(filePath, "external edit\n", "utf-8");

        commands.execute("workbench.action.files.save");
        await flushMicrotasks();
        testApp.render();

        dialog()!.onCancel?.();
        await flushMicrotasks();
        testApp.render();

        expect(fs.readFileSync(filePath, "utf-8")).toBe("external edit\n");
    });

    it("saves without a prompt when the file was not changed externally", async () => {
        commands.execute("workbench.action.files.save");
        await flushMicrotasks();
        testApp.render();

        expect(dialog()).toBeNull();
        expect(fs.readFileSync(filePath, "utf-8")).toContain("X");
    });
});
