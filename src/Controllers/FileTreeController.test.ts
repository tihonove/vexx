import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { FileTreeController } from "./FileTreeController.ts";

describe("FileTreeController", () => {
    let ws: ITempWorkspace;
    let controller: FileTreeController;
    let app: TestApp;

    beforeEach(async () => {
        ws = createTempWorkspace({ prefix: "vexx-ctrl-test-", files: { "src/main.ts": "", "README.md": "" } });
        controller = new FileTreeController();
        controller.setRootPath(ws.dir);
        controller.mount();
        app = TestApp.createWithContent(controller.view, new Size(30, 10));
        controller.focus();
        await controller.activate();
        app.render();
    });

    afterEach(() => {
        controller.dispose();
        ws.dispose();
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
        expect(activated).toEqual([ws.path("README.md")]);
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
        expect(activated[0]).toBe(ws.path("README.md"));
    });

    it("cleans up on dispose", () => {
        controller.dispose();
        // No error thrown — test passes
    });

    it("exposes the root path via getRootPath/hasRootPath", () => {
        expect(controller.hasRootPath()).toBe(true);
        expect(controller.getRootPath()).toBe(ws.dir);
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

    it("colours a decorated file's name and draws its status badge", async () => {
        const gitColor = packRgb(115, 201, 145);
        // README.md is row 1 (src is the cursor on row 0), so its name takes the
        // decoration colour; "U" is a badge letter absent from the sidebar chrome.
        controller.setFileDecorations([{ path: ws.path("README.md"), color: gitColor, badge: "U" }]);
        await new Promise((r) => setTimeout(r, 20));
        app.render();

        expect(app.backend.screenToString()).toContain("U");

        // Some cell now carries the resolved git decoration colour as its fg.
        let coloured = false;
        const size = app.backend.getSize();
        for (let y = 0; y < size.height && !coloured; y++) {
            for (let x = 0; x < size.width; x++) {
                if (app.backend.getFgAt(new Point(x, y)) === gitColor) {
                    coloured = true;
                    break;
                }
            }
        }
        expect(coloured).toBe(true);
    });

    it("clears decorations when given an empty list", async () => {
        const gitColor = packRgb(115, 201, 145);
        controller.setFileDecorations([{ path: ws.path("README.md"), color: gitColor, badge: "U" }]);
        await new Promise((r) => setTimeout(r, 20));
        app.render();
        expect(app.backend.screenToString()).toContain("U");

        controller.setFileDecorations([]);
        await new Promise((r) => setTimeout(r, 20));
        app.render();
        expect(app.backend.screenToString()).not.toContain("U");
    });

    it("forwards a provider watch error to the controller's onWatchError", () => {
        // Провайдер отдаёт ошибку watcher'а (ENOSPC и т.п.) — контроллер обязан
        // пробросить её наверх через свой onWatchError (см. AppController, где логируют).
        const seen: { dirPath: string; error: Error }[] = [];
        controller.onWatchError = (dirPath, error) => {
            seen.push({ dirPath, error });
        };

        const provider = (
            controller as unknown as {
                provider: { onWatchError?: (dirPath: string, error: Error) => void };
            }
        ).provider;
        const err = new Error("ENOSPC: watch limit reached");
        provider.onWatchError?.(ws.path("src"), err);

        expect(seen).toEqual([{ dirPath: ws.path("src"), error: err }]);
    });
});

describe("FileTreeController — clipboard helpers before a root is assigned", () => {
    it("returns an empty selection and a null paste target without a tree", () => {
        const controller = new FileTreeController();

        expect(controller.getSelectedPaths()).toEqual([]);
        expect(controller.getPasteTargetDir()).toBeNull();
        // Подсветка «вырезанных» без дерева — no-op, не должна падать.
        expect(() => {
            controller.setCutPaths(["/x"]);
        }).not.toThrow();
        // Статус-декорации без дерева — тоже no-op.
        expect(() => {
            controller.setFileDecorations([{ path: "/x", color: 0x73c991, badge: "M" }]);
        }).not.toThrow();

        controller.dispose();
    });

    it("paste target falls back to the root when the tree is empty", async () => {
        const ws = createTempWorkspace({ prefix: "vexx-ctrl-empty-" });
        const controller = new FileTreeController();
        controller.setRootPath(ws.dir);
        controller.mount();
        await controller.activate();

        expect(controller.getPasteTargetDir()).toBe(ws.dir);

        controller.dispose();
        ws.dispose();
    });
});

describe("FileTreeController — setRootPath after mount", () => {
    let wsA: ITempWorkspace;
    let wsB: ITempWorkspace;

    beforeEach(() => {
        wsA = createTempWorkspace({ prefix: "vexx-ctrl-a-", files: { "alpha.ts": "" } });
        wsB = createTempWorkspace({ prefix: "vexx-ctrl-b-", files: { "beta.ts": "" } });
    });

    afterEach(() => {
        wsA.dispose();
        wsB.dispose();
    });

    it("wires events for a root assigned after mount() and reflects the new root", async () => {
        const controller = new FileTreeController();
        // mount() first, while there is no tree yet (tree-less mount path).
        controller.mount();
        // Assigning the root after mount must wire tree events (line 48 / branch 47).
        controller.setRootPath(wsB.dir);

        const app = TestApp.createWithContent(controller.view, new Size(30, 10));
        controller.focus();
        await controller.activate();
        app.render();

        const activated: string[] = [];
        controller.onFileActivate = (filePath) => {
            activated.push(filePath);
        };

        // The single file in wsB must be selectable and openable — proving events wired.
        expect(app.backend.screenToString()).toContain("beta.ts");
        app.sendKey("Enter");
        app.render();
        expect(activated).toEqual([wsB.path("beta.ts")]);

        controller.dispose();
    });

    it("refresh() is a no-op before a root is assigned and works after", async () => {
        const controller = new FileTreeController();
        controller.mount();
        // No tree yet → refresh() takes the guarded no-op path (branch 74).
        await expect(controller.refresh()).resolves.toBeUndefined();

        controller.setRootPath(wsA.dir);
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
    let ws: ITempWorkspace;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-ctrl-test-", files: { "index.ts": "" } });
    });

    afterEach(() => {
        ws.dispose();
    });

    it("applies sideBar.background from theme after setRootPath", async () => {
        const themeFile = {
            ...darkPlusTheme,
            colors: { ...darkPlusTheme.colors, "sideBar.background": "#2D2D2D" },
        };
        const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(themeFile));
        const controller = new FileTreeController(themeService);
        controller.setRootPath(ws.dir);
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
        controller.setRootPath(ws.dir);
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

    it("uses default registry sidebar fg/bg when the theme defines neither", async () => {
        // A theme with no colors at all: sideBar.foreground and sideBar.background are
        // supplied by the dark default color registry, so the sidebar is always colored.
        const bareThemeFile = { ...darkPlusTheme, colors: {} };
        const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(bareThemeFile));
        const controller = new FileTreeController(themeService);
        controller.setRootPath(ws.dir);
        controller.mount();

        const app = TestApp.createWithContent(controller.view, new Size(30, 10));
        await controller.activate();
        app.render();

        // Sidebar colors come from the dark default registry.
        expect(controller.view.style.fg).toBe(0xcccccc); // default dark "sideBar.foreground"
        expect(controller.view.style.bg).toBe(0x252526); // default dark "sideBar.background"
        // Still renders its contents.
        expect(app.backend.screenToString()).toContain("index.ts");

        controller.dispose();
    });
});
