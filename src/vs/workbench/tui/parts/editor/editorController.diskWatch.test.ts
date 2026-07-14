import * as fs from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { IDisposable } from "../../../../base/common/lifecycle.ts";
import { NULL_LANGUAGE_SERVICE } from "../../../../editor/common/languages/language.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../../../editor/common/languages/tokenStyleResolver.ts";
import { TokenizationRegistry } from "../../../../editor/common/tokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../../../../TestUtils/TempWorkspace.ts";
import { darkPlusTheme } from "../../../services/themes/common/themes/darkPlus.ts";
import { ThemeService } from "../../../services/themes/common/themeService.ts";
import { WorkbenchTheme } from "../../../services/themes/common/workbenchTheme.ts";

import { EditorController } from "./editorController.ts";
import type { IFileWatcher } from "../../../../platform/files/common/watcher.ts";
import { UndoRedoService } from "../../../../platform/undoRedo/common/undoRedoService.ts";

/** Fake watcher: records the onChange callback per path so tests fire it by hand. */
class FakeFileWatcher implements IFileWatcher {
    private handlers = new Map<string, () => void>();

    public watchFile(filePath: string, onChange: () => void): IDisposable {
        this.handlers.set(filePath, onChange);
        return { dispose: () => this.handlers.delete(filePath) };
    }

    public fire(filePath: string): void {
        this.handlers.get(filePath)?.();
    }

    public isWatching(filePath: string): boolean {
        return this.handlers.has(filePath);
    }
}

function createEditorController(): EditorController {
    return new EditorController(
        new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)),
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
        new UndoRedoService(),
    );
}

describe("EditorController — external change detection", () => {
    let ws: ITempWorkspace;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-diskwatch-" });
    });

    afterEach(() => {
        ws.dispose();
    });

    function writeFile(name: string, content: string): string {
        return ws.writeFile(name, content);
    }

    describe("save conflict guard", () => {
        it("blocks the write when the file changed on disk and reports a conflict", async () => {
            const controller = createEditorController();
            const fp = writeFile("a.txt", "original\n");
            controller.openFile(fp);
            controller.viewState.type("X"); // buffer now dirty

            // Another process rewrites the file behind our back.
            fs.writeFileSync(fp, "external change from elsewhere\n", "utf-8");

            const outcome = await controller.save();

            expect(outcome).toBe("conflict");
            expect(controller.hasDiskConflict).toBe(true);
            // The parallel change on disk survives — we did NOT clobber it.
            expect(fs.readFileSync(fp, "utf-8")).toBe("external change from elsewhere\n");
            controller.dispose();
        });

        it("overwrites when explicitly asked, clearing the conflict", async () => {
            const controller = createEditorController();
            const fp = writeFile("b.txt", "original\n");
            controller.openFile(fp);
            controller.viewState.type("X");
            fs.writeFileSync(fp, "external\n", "utf-8");

            expect(await controller.save()).toBe("conflict");
            const outcome = await controller.save({ overwrite: true });

            expect(outcome).toBe("saved");
            expect(controller.hasDiskConflict).toBe(false);
            expect(fs.readFileSync(fp, "utf-8")).toBe("Xoriginal\n");
            controller.dispose();
        });

        it("saves normally when the file was not touched externally", async () => {
            const controller = createEditorController();
            const fp = writeFile("c.txt", "hello\n");
            controller.openFile(fp);
            controller.viewState.type("Y");

            expect(await controller.save()).toBe("saved");
            expect(fs.readFileSync(fp, "utf-8")).toBe("Yhello\n");
            controller.dispose();
        });

        it("returns no-file when there is no path", async () => {
            const controller = createEditorController();
            expect(await controller.save()).toBe("no-file");
            controller.dispose();
        });

        it("creates a file that did not exist on disk at open time", async () => {
            const controller = createEditorController();
            const fp = ws.path("fresh.txt"); // does not exist yet
            controller.openFile(fp);
            controller.viewState.type("brand new\n");

            expect(await controller.save()).toBe("saved");
            expect(fs.readFileSync(fp, "utf-8")).toBe("brand new\n");
            controller.dispose();
        });
    });

    describe("live watcher", () => {
        it("watches the file after openFile and stops on dispose", () => {
            const watcher = new FakeFileWatcher();
            const controller = createEditorController();
            controller.fileWatcher = watcher;
            const fp = writeFile("w.txt", "x\n");
            controller.openFile(fp);

            expect(watcher.isWatching(fp)).toBe(true);
            controller.dispose();
            expect(watcher.isWatching(fp)).toBe(false);
        });

        it("auto-reloads a clean buffer when the file changes on disk", () => {
            const watcher = new FakeFileWatcher();
            const controller = createEditorController();
            controller.fileWatcher = watcher;
            const fp = writeFile("clean.txt", "v1\n");
            controller.openFile(fp);

            let contentEvents = 0;
            let diskStateEvents = 0;
            controller.onDidChangeContent(() => contentEvents++);
            controller.onDidChangeDiskState(() => diskStateEvents++);

            fs.writeFileSync(fp, "v2 from disk\n", "utf-8");
            watcher.fire(fp);

            expect(controller.getText()).toBe("v2 from disk\n");
            expect(controller.isModified).toBe(false);
            expect(controller.hasDiskConflict).toBe(false);
            // Reload notifies via disk-state (tab sync hangs off this event).
            expect(diskStateEvents).toBe(1);

            // Reload recreated the document — the controller-level content
            // subscription must survive it and still fire on later edits.
            controller.viewState.type("q");
            expect(contentEvents).toBeGreaterThan(0);
            controller.dispose();
        });

        it("keeps a dirty buffer and flags a conflict instead of reloading", () => {
            const watcher = new FakeFileWatcher();
            const controller = createEditorController();
            controller.fileWatcher = watcher;
            const fp = writeFile("dirty.txt", "v1\n");
            controller.openFile(fp);
            controller.viewState.type("Z"); // dirty

            let diskStateEvents = 0;
            controller.onDidChangeDiskState(() => diskStateEvents++);

            fs.writeFileSync(fp, "v2 from disk\n", "utf-8");
            watcher.fire(fp);

            expect(controller.hasDiskConflict).toBe(true);
            expect(controller.getText()).toBe("Zv1\n"); // user's edits preserved
            expect(diskStateEvents).toBe(1);
            controller.dispose();
        });

        it("ignores its own writes (no spurious reload/conflict)", async () => {
            const watcher = new FakeFileWatcher();
            const controller = createEditorController();
            controller.fileWatcher = watcher;
            const fp = writeFile("own.txt", "v1\n");
            controller.openFile(fp);
            controller.viewState.type("A");

            await controller.save();
            // A watcher event for our own save must not re-trigger anything.
            watcher.fire(fp);

            expect(controller.hasDiskConflict).toBe(false);
            expect(controller.getText()).toBe("Av1\n");
            controller.dispose();
        });

        it("ignores transient disappearance of the file (atomic-save unlink)", () => {
            const watcher = new FakeFileWatcher();
            const controller = createEditorController();
            controller.fileWatcher = watcher;
            const fp = writeFile("atomic.txt", "keep\n");
            controller.openFile(fp);

            fs.rmSync(fp);
            watcher.fire(fp);

            // File gone mid-atomic-write: do not clobber the buffer to empty.
            expect(controller.getText()).toBe("keep\n");
            expect(controller.hasDiskConflict).toBe(false);
            controller.dispose();
        });
    });

    describe("subscription disposal", () => {
        it("stops delivering disk-state events after dispose (double dispose is a no-op)", () => {
            const watcher = new FakeFileWatcher();
            const controller = createEditorController();
            controller.fileWatcher = watcher;
            const fp = writeFile("sub.txt", "v1\n");
            controller.openFile(fp);

            let events = 0;
            const subscription = controller.onDidChangeDiskState(() => events++);
            subscription.dispose();
            subscription.dispose(); // no-op

            fs.writeFileSync(fp, "v2 longer\n", "utf-8");
            watcher.fire(fp);
            expect(events).toBe(0);
            controller.dispose();
        });

        it("stops delivering content events after dispose (double dispose is a no-op)", () => {
            const controller = createEditorController();
            const fp = writeFile("sub2.txt", "v1\n");
            controller.openFile(fp);

            let events = 0;
            const subscription = controller.onDidChangeContent(() => events++);
            subscription.dispose();
            subscription.dispose(); // no-op

            controller.viewState.type("x");
            expect(events).toBe(0);
            controller.dispose();
        });
    });

    describe("revertToDisk", () => {
        it("discards unsaved edits and reloads from disk", () => {
            const controller = createEditorController();
            const fp = writeFile("r.txt", "disk\n");
            controller.openFile(fp);
            controller.viewState.type("edit ");
            expect(controller.isModified).toBe(true);

            expect(controller.revertToDisk()).toBe(true);

            expect(controller.getText()).toBe("disk\n");
            expect(controller.isModified).toBe(false);
            controller.dispose();
        });

        it("returns false without a file path", () => {
            const controller = createEditorController();
            expect(controller.revertToDisk()).toBe(false);
            controller.dispose();
        });
    });
});
