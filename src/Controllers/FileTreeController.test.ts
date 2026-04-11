import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { FileTreeController } from "./FileTreeController.ts";

function createTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-ctrl-test-"));
    fs.mkdirSync(path.join(dir, "src"));
    fs.writeFileSync(path.join(dir, "src", "main.ts"), "");
    fs.writeFileSync(path.join(dir, "README.md"), "");
    return dir;
}

function cleanupDir(dirPath: string): void {
    fs.rmSync(dirPath, { recursive: true, force: true });
}

describe("FileTreeController", () => {
    let tmpDir: string;
    let controller: FileTreeController;
    let app: TestApp;

    beforeEach(async () => {
        tmpDir = createTempDir();
        controller = new FileTreeController(tmpDir);
        controller.mount();
        app = TestApp.createWithContent(controller.view, new Size(30, 10));
        controller.focus();
        await controller.activate();
        app.render();
    });

    afterEach(() => {
        controller.dispose();
        cleanupDir(tmpDir);
    });

    it("creates a view element", () => {
        expect(controller.view).toBeDefined();
    });

    it("shows root directory contents after activation", () => {
        const output = app.backend.screenToString();
        // Should show "src" directory and "README.md" file
        expect(output).toContain("src");
        expect(output).toContain("README.md");
    });

    it("navigates between items with keyboard", () => {
        const output1 = app.backend.screenToString();
        expect(output1).toContain("src");

        app.sendKey("ArrowDown");
        app.render();

        // After navigating, still shows both items
        const output2 = app.backend.screenToString();
        expect(output2).toContain("src");
        expect(output2).toContain("README.md");
    });

    it("expands directory with ArrowRight", async () => {
        // First item should be "src" directory
        app.sendKey("ArrowRight");
        await new Promise((r) => setTimeout(r, 50));
        app.render();

        const output = app.backend.screenToString();
        expect(output).toContain("main.ts");
    });

    it("cleans up on dispose", () => {
        controller.dispose();
        // No error thrown — test passes
    });
});
