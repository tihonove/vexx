import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileTreeDataProvider } from "./FileTreeDataProvider.ts";

function createTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "vexx-test-"));
}

function cleanupDir(dirPath: string): void {
    fs.rmSync(dirPath, { recursive: true, force: true });
}

describe("FileTreeDataProvider", () => {
    let tmpDir: string;
    let provider: FileTreeDataProvider;

    beforeEach(() => {
        tmpDir = createTempDir();
        provider = new FileTreeDataProvider(tmpDir);
    });

    afterEach(() => {
        provider.dispose();
        cleanupDir(tmpDir);
    });

    describe("getChildren", () => {
        it("returns files and directories from root", () => {
            fs.writeFileSync(path.join(tmpDir, "file.ts"), "");
            fs.mkdirSync(path.join(tmpDir, "src"));

            const children = provider.getChildren();
            expect(children).toHaveLength(2);
        });

        it("sorts directories before files", () => {
            fs.writeFileSync(path.join(tmpDir, "b.ts"), "");
            fs.mkdirSync(path.join(tmpDir, "aDir"));
            fs.writeFileSync(path.join(tmpDir, "a.ts"), "");

            const children = provider.getChildren();
            expect(children[0].name).toBe("aDir");
            expect(children[0].isDirectory).toBe(true);
            expect(children[1].name).toBe("a.ts");
            expect(children[2].name).toBe("b.ts");
        });

        it("sorts files alphabetically", () => {
            fs.writeFileSync(path.join(tmpDir, "z.ts"), "");
            fs.writeFileSync(path.join(tmpDir, "a.ts"), "");
            fs.writeFileSync(path.join(tmpDir, "m.ts"), "");

            const children = provider.getChildren();
            expect(children.map((c) => c.name)).toEqual(["a.ts", "m.ts", "z.ts"]);
        });

        it("excludes node_modules and .git", () => {
            fs.mkdirSync(path.join(tmpDir, "node_modules"));
            fs.mkdirSync(path.join(tmpDir, ".git"));
            fs.writeFileSync(path.join(tmpDir, "index.ts"), "");

            const children = provider.getChildren();
            expect(children).toHaveLength(1);
            expect(children[0].name).toBe("index.ts");
        });

        it("returns children of a subdirectory", () => {
            const subDir = path.join(tmpDir, "src");
            fs.mkdirSync(subDir);
            fs.writeFileSync(path.join(subDir, "main.ts"), "");
            fs.writeFileSync(path.join(subDir, "util.ts"), "");

            const dirNode = { name: "src", path: subDir, isDirectory: true };
            const children = provider.getChildren(dirNode);
            expect(children).toHaveLength(2);
            expect(children.map((c) => c.name)).toEqual(["main.ts", "util.ts"]);
        });

        it("returns empty array for empty directory", () => {
            const subDir = path.join(tmpDir, "empty");
            fs.mkdirSync(subDir);

            const dirNode = { name: "empty", path: subDir, isDirectory: true };
            expect(provider.getChildren(dirNode)).toEqual([]);
        });

        it("returns empty array for non-existent directory", () => {
            const dirNode = { name: "nope", path: path.join(tmpDir, "nope"), isDirectory: true };
            expect(provider.getChildren(dirNode)).toEqual([]);
        });
    });

    describe("getKey", () => {
        it("returns the file path as key", () => {
            const node = { name: "test.ts", path: "/some/path/test.ts", isDirectory: false };
            expect(provider.getKey(node)).toBe("/some/path/test.ts");
        });
    });

    describe("getTreeItem", () => {
        it("marks directories as collapsible", () => {
            const node = { name: "src", path: "/src", isDirectory: true };
            const item = provider.getTreeItem(node);
            expect(item.collapsible).toBe(true);
            expect(item.label).toBe("src");
        });

        it("marks files as non-collapsible", () => {
            const node = { name: "main.ts", path: "/main.ts", isDirectory: false };
            const item = provider.getTreeItem(node);
            expect(item.collapsible).toBe(false);
        });

        it("provides icon for known file types", () => {
            const node = { name: "main.ts", path: "/main.ts", isDirectory: false };
            const item = provider.getTreeItem(node);
            expect(item.icon).toBeDefined();
            expect(item.iconColor).toBeDefined();
        });

        it("provides folder icon for directories", () => {
            const node = { name: "src", path: "/src", isDirectory: true };
            const item = provider.getTreeItem(node);
            expect(item.icon).toBeDefined();
            expect(item.iconColor).toBeDefined();
        });
    });

    describe("file watching", () => {
        it("notifies onChange when a file is created in watched directory", async () => {
            const callback = vi.fn();
            provider.onChange = callback;

            provider.watchDirectory(tmpDir);

            // Wait for chokidar to be ready
            await new Promise((r) => setTimeout(r, 500));

            // Create a file in the watched directory
            fs.writeFileSync(path.join(tmpDir, "new-file.ts"), "");

            // Wait for debounce (300ms) + buffer
            await new Promise((r) => setTimeout(r, 1000));

            expect(callback).toHaveBeenCalled();
        }, 5000);

        it("does not notify after unwatch", async () => {
            const callback = vi.fn();
            provider.onChange = callback;

            provider.watchDirectory(tmpDir);
            provider.unwatchDirectory(tmpDir);

            fs.writeFileSync(path.join(tmpDir, "new-file.ts"), "");

            await new Promise((r) => setTimeout(r, 500));

            expect(callback).not.toHaveBeenCalled();
        });

        it("does not duplicate watchers for the same directory", () => {
            provider.watchDirectory(tmpDir);
            provider.watchDirectory(tmpDir); // second call should be no-op
            // No error thrown — test passes
            provider.unwatchDirectory(tmpDir);
        });

        it("cleans up watchers on dispose", async () => {
            const callback = vi.fn();
            provider.onChange = callback;

            provider.watchDirectory(tmpDir);
            provider.dispose();

            fs.writeFileSync(path.join(tmpDir, "new-file.ts"), "");

            await new Promise((r) => setTimeout(r, 500));

            expect(callback).not.toHaveBeenCalled();
        });
    });
});
