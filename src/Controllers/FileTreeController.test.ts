import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

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
        controller = new FileTreeController();
        controller.setRootPath(tmpDir);
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

    it("activating a directory node does not open an editor", () => {
        const activated: string[] = [];
        controller.onFileActivate = (filePath) => {
            activated.push(filePath);
        };

        // First item is the "src" directory (confirmed by other tests).
        app.sendKey("Enter");
        app.render();

        // Directories never fire onFileActivate — they toggle/expand instead.
        expect(activated).toEqual([]);
    });

    it("a file node activated via Enter opens, a directory activated via Enter does not", () => {
        const activated: string[] = [];
        controller.onFileActivate = (filePath) => {
            activated.push(filePath);
        };

        // src directory is first/selected — Enter must not open it.
        app.sendKey("Enter");
        app.render();
        expect(activated).toEqual([]);

        // Move to README.md (a file) — Enter must open it.
        app.sendKey("ArrowDown");
        app.render();
        app.sendKey("Enter");
        app.render();
        expect(activated).toEqual([path.join(tmpDir, "README.md")]);
    });

    it("activating a file node fires onFileActivate with its path", () => {
        const activated: string[] = [];
        controller.onFileActivate = (filePath) => {
            activated.push(filePath);
        };

        // Move from "src" (dir) down to "README.md" (file), then activate.
        app.sendKey("ArrowDown");
        app.render();
        app.sendKey("Enter");
        app.render();

        expect(activated).toHaveLength(1);
        expect(activated[0]).toBe(path.join(tmpDir, "README.md"));
    });

    it("cleans up on dispose", () => {
        controller.dispose();
        // No error thrown — test passes
    });

    it("exposes the root path via getRootPath/hasRootPath", () => {
        expect(controller.hasRootPath()).toBe(true);
        expect(controller.getRootPath()).toBe(tmpDir);
    });

    it("expanding then collapsing a directory still renders the tree (watch/unwatch)", async () => {
        // ArrowRight expands "src" (onExpandedChanged → watchDirectory).
        app.sendKey("ArrowRight");
        await new Promise((r) => setTimeout(r, 50));
        app.render();
        expect(app.backend.screenToString()).toContain("main.ts");

        // ArrowLeft collapses it (onExpandedChanged → unwatchDirectory, line 90).
        app.sendKey("ArrowLeft");
        await new Promise((r) => setTimeout(r, 50));
        app.render();

        const output = app.backend.screenToString();
        // Collapsed: child is hidden again, root entries remain.
        expect(output).not.toContain("main.ts");
        expect(output).toContain("src");
        expect(output).toContain("README.md");
    });
});

describe("FileTreeController — setRootPath after mount", () => {
    let dirA: string;
    let dirB: string;

    function makeDir(prefix: string, fileName: string): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
        fs.writeFileSync(path.join(dir, fileName), "");
        return dir;
    }

    beforeEach(() => {
        dirA = makeDir("vexx-ctrl-a-", "alpha.ts");
        dirB = makeDir("vexx-ctrl-b-", "beta.ts");
    });

    afterEach(() => {
        cleanupDir(dirA);
        cleanupDir(dirB);
    });

    it("wires events for a root assigned after mount() and reflects the new root", async () => {
        const controller = new FileTreeController();
        // mount() first, while there is no tree yet (tree-less mount path).
        controller.mount();
        // Assigning the root after mount must wire tree events (line 48 / branch 47).
        controller.setRootPath(dirB);

        const app = TestApp.createWithContent(controller.view, new Size(30, 10));
        controller.focus();
        await controller.activate();
        app.render();

        const activated: string[] = [];
        controller.onFileActivate = (filePath) => {
            activated.push(filePath);
        };

        // The single file in dirB must be selectable and openable — proving events wired.
        expect(app.backend.screenToString()).toContain("beta.ts");
        app.sendKey("Enter");
        app.render();
        expect(activated).toEqual([path.join(dirB, "beta.ts")]);

        controller.dispose();
    });

    it("refresh() is a no-op before a root is assigned and works after", async () => {
        const controller = new FileTreeController();
        controller.mount();
        // No tree yet → refresh() takes the guarded no-op path (branch 74).
        await expect(controller.refresh()).resolves.toBeUndefined();

        controller.setRootPath(dirA);
        const app = TestApp.createWithContent(controller.view, new Size(30, 10));
        await controller.activate();
        // refresh() with a tree present re-reads the directory.
        await controller.refresh();
        app.render();
        expect(app.backend.screenToString()).toContain("alpha.ts");

        controller.dispose();
    });
});

describe("FileTreeController with ThemeService", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-ctrl-test-"));
        fs.writeFileSync(path.join(tmpDir, "index.ts"), "");
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("applies sideBar.background from theme after setRootPath", async () => {
        const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
        const controller = new FileTreeController(themeService);
        controller.setRootPath(tmpDir);
        controller.mount();

        const app = TestApp.createWithContent(controller.view, new Size(30, 10));
        await controller.activate();
        app.render();

        const expectedBg = themeService.theme.getColor("sideBar.background")!;
        // Top-left cell of the sidebar view must use the sidebar background
        expect(app.backend.getBgAt(new Point(0, 0))).toBe(expectedBg);

        controller.dispose();
    });

    it("applies sideBar.background when theme changes after setRootPath", async () => {
        const initialTheme = WorkbenchTheme.fromThemeFile(darkPlusTheme);
        const themeService = new ThemeService(initialTheme);
        const controller = new FileTreeController(themeService);
        controller.setRootPath(tmpDir);
        controller.mount();

        const newBg = packRgb(0x40, 0x40, 0x40);
        const newThemeFile = {
            ...darkPlusTheme,
            colors: { ...darkPlusTheme.colors, "sideBar.background": "#404040" },
        };
        themeService.setTheme(WorkbenchTheme.fromThemeFile(newThemeFile));

        const app = TestApp.createWithContent(controller.view, new Size(30, 10));
        await controller.activate();
        app.render();

        expect(app.backend.getBgAt(new Point(0, 0))).toBe(newBg);

        controller.dispose();
    });

    it("omits sidebar fg/bg style when the theme defines neither (branches 123/124)", async () => {
        // A theme with no colors at all: sideBar.foreground and sideBar.background are
        // both undefined, so applyTheme takes the false side of both ternaries.
        const bareThemeFile = { ...darkPlusTheme, colors: {} };
        const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(bareThemeFile));
        const controller = new FileTreeController(themeService);
        controller.setRootPath(tmpDir);
        controller.mount();

        const app = TestApp.createWithContent(controller.view, new Size(30, 10));
        await controller.activate();
        app.render();

        // No sidebar colors → view.style carries neither fg nor bg.
        expect(controller.view.style.fg).toBeUndefined();
        expect(controller.view.style.bg).toBeUndefined();
        // Still renders its contents.
        expect(app.backend.screenToString()).toContain("index.ts");

        controller.dispose();
    });
});
