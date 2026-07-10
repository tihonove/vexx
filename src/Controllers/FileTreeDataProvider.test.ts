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

        it("orders files after directories for a dir/file/dir name sequence (sort branch 119)", () => {
            // readdir yields these alphabetically as [a-dir, b-file, c-dir] — a
            // dir/file/dir sequence that drives the comparator down BOTH the
            // `-1` (dir before file) and `1` (file after dir) paths.
            fs.mkdirSync(path.join(tmpDir, "a-dir"));
            fs.writeFileSync(path.join(tmpDir, "b-file.ts"), "");
            fs.mkdirSync(path.join(tmpDir, "c-dir"));

            const children = provider.getChildren();
            // Directories first (sorted), then the file.
            expect(children.map((c) => c.name)).toEqual(["a-dir", "c-dir", "b-file.ts"]);
            expect(children.map((c) => c.isDirectory)).toEqual([true, true, false]);
        });
    });

    describe("symlinks", () => {
        it("marks a symlink to a file as a symbolic link, not a directory", () => {
            fs.writeFileSync(path.join(tmpDir, "target.ts"), "");
            fs.symlinkSync(path.join(tmpDir, "target.ts"), path.join(tmpDir, "link.ts"));

            const children = provider.getChildren();
            const link = children.find((c) => c.name === "link.ts");
            expect(link).toBeDefined();
            expect(link?.isSymbolicLink).toBe(true);
            expect(link?.isDirectory).toBe(false);
        });

        it("resolves a symlink to a directory as a directory", () => {
            fs.mkdirSync(path.join(tmpDir, "realDir"));
            fs.symlinkSync(path.join(tmpDir, "realDir"), path.join(tmpDir, "linkDir"));

            const children = provider.getChildren();
            const link = children.find((c) => c.name === "linkDir");
            expect(link?.isSymbolicLink).toBe(true);
            expect(link?.isDirectory).toBe(true);
        });

        it("treats a broken symlink as a non-directory file", () => {
            fs.symlinkSync(path.join(tmpDir, "does-not-exist"), path.join(tmpDir, "broken"));

            const children = provider.getChildren();
            const link = children.find((c) => c.name === "broken");
            expect(link?.isSymbolicLink).toBe(true);
            expect(link?.isDirectory).toBe(false);
        });

        it("flags a symlinked file while keeping its normal type icon", () => {
            const node = { name: "link.ts", path: "/link.ts", isDirectory: false, isSymbolicLink: true };
            const item = provider.getTreeItem(node);
            expect(item.symlink).toBe(true);
            // The type icon is preserved — same as a non-symlink .ts file (icon not hidden).
            const plain = provider.getTreeItem({ name: "link.ts", path: "/link.ts", isDirectory: false });
            expect(item.icon).toBe(plain.icon);
            expect(item.iconColor).toBe(plain.iconColor);
        });

        it("flags a symlinked directory and keeps it collapsible", () => {
            const node = { name: "linkDir", path: "/linkDir", isDirectory: true, isSymbolicLink: true };
            const item = provider.getTreeItem(node);
            expect(item.collapsible).toBe(true);
            expect(item.symlink).toBe(true);
        });

        it("does not flag a regular file or directory as a symlink", () => {
            const file = provider.getTreeItem({ name: "main.ts", path: "/main.ts", isDirectory: false });
            const dir = provider.getTreeItem({ name: "src", path: "/src", isDirectory: true });
            expect(file.symlink).toBeFalsy();
            expect(dir.symlink).toBeFalsy();
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

        it("does not provide icon for directories", () => {
            const node = { name: "src", path: "/src", isDirectory: true };
            const item = provider.getTreeItem(node);
            expect(item.icon).toBeUndefined();
            expect(item.iconColor).toBeUndefined();
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

        it("unwatchDirectory on a directory that was never watched is a no-op (branch 76)", () => {
            expect(() => {
                provider.unwatchDirectory(path.join(tmpDir, "never-watched"));
            }).not.toThrow();
        });

        it("survives a watcher 'error' (e.g. ENOSPC) instead of crashing", async () => {
            // Регрессия на исходный краш: chokidar при исчерпании лимита inotify делает
            // emit('error'); без слушателя 'error' EventEmitter бросил бы исключение из
            // своих async-потрохов, оно всплыло бы как unhandledRejection и убило процесс.
            const onWatchError = vi.fn();
            provider.onWatchError = onWatchError;

            provider.watchDirectory(tmpDir);
            await new Promise((r) => setTimeout(r, 300)); // дать chokidar устояться

            const watchers = (
                provider as unknown as {
                    watchers: Map<string, { emit(event: string, ...args: unknown[]): boolean }>;
                }
            ).watchers;
            const watcher = watchers.get(tmpDir);
            expect(watcher).toBeDefined();

            const err = Object.assign(new Error("ENOSPC: watch limit reached"), { code: "ENOSPC" });

            // Эмит 'error' НЕ должен бросать (иначе — краш процесса).
            expect(() => watcher?.emit("error", err)).not.toThrow();

            // Ошибка проброшена наверх с путём каталога и объектом ошибки.
            expect(onWatchError).toHaveBeenCalledWith(tmpDir, err);

            // Неудавшийся watcher убран из карты — повторное раскрытие сможет попробовать снова.
            expect(watchers.has(tmpDir)).toBe(false);
        });
    });

    describe("debounce timer lifecycle", () => {
        /** Wait until a 300ms debounce timer has been scheduled by debouncedNotify. */
        async function waitForPendingDebounce(spy: { mock: { calls: unknown[][] } }): Promise<void> {
            await vi.waitFor(
                () => {
                    const scheduled = spy.mock.calls.some((call: unknown[]) => call[1] === 300);
                    expect(scheduled).toBe(true);
                },
                { interval: 10, timeout: 4000 },
            );
        }

        it("clears a pending debounce timer when its directory is unwatched (lines 83-84, branch 82)", async () => {
            const callback = vi.fn();
            provider.onChange = callback;
            provider.watchDirectory(tmpDir);
            // Wait for chokidar to settle before emitting an event.
            await new Promise((r) => setTimeout(r, 500));

            const setSpy = vi.spyOn(globalThis, "setTimeout");
            const clearSpy = vi.spyOn(globalThis, "clearTimeout");

            // Trigger a watcher event → debouncedNotify schedules a 300ms timer.
            fs.writeFileSync(path.join(tmpDir, "trigger.ts"), "");
            await waitForPendingDebounce(setSpy);

            const clearsBefore = clearSpy.mock.calls.length;
            // Unwatching while the debounce timer is pending must clear it (lines 83-84).
            provider.unwatchDirectory(tmpDir);
            expect(clearSpy.mock.calls.length).toBeGreaterThan(clearsBefore);

            // The cleared timer must never fire onChange.
            await new Promise((r) => setTimeout(r, 400));
            expect(callback).not.toHaveBeenCalled();

            setSpy.mockRestore();
            clearSpy.mockRestore();
        }, 8000);

        it("clears pending debounce timers on dispose (line 94)", async () => {
            const callback = vi.fn();
            provider.onChange = callback;
            provider.watchDirectory(tmpDir);
            await new Promise((r) => setTimeout(r, 500));

            const setSpy = vi.spyOn(globalThis, "setTimeout");
            const clearSpy = vi.spyOn(globalThis, "clearTimeout");

            fs.writeFileSync(path.join(tmpDir, "trigger.ts"), "");
            await waitForPendingDebounce(setSpy);

            const clearsBefore = clearSpy.mock.calls.length;
            provider.dispose();
            // dispose() iterates pending debounce timers and clears them (line 94).
            expect(clearSpy.mock.calls.length).toBeGreaterThan(clearsBefore);

            await new Promise((r) => setTimeout(r, 400));
            expect(callback).not.toHaveBeenCalled();

            setSpy.mockRestore();
            clearSpy.mockRestore();
        }, 8000);

        it("collapses back-to-back events into one notification (debounce reset, branch 128)", async () => {
            const callback = vi.fn();
            provider.onChange = callback;
            provider.watchDirectory(tmpDir);
            await new Promise((r) => setTimeout(r, 500));

            // Several rapid events: each subsequent debouncedNotify sees an existing
            // timer and clears it before re-scheduling (branch 128 true path).
            fs.writeFileSync(path.join(tmpDir, "one.ts"), "");
            fs.writeFileSync(path.join(tmpDir, "two.ts"), "");
            fs.writeFileSync(path.join(tmpDir, "three.ts"), "");
            await new Promise((r) => setTimeout(r, 100));
            fs.writeFileSync(path.join(tmpDir, "four.ts"), "");
            fs.writeFileSync(path.join(tmpDir, "five.ts"), "");

            // Wait past the debounce window for the coalesced notification.
            await new Promise((r) => setTimeout(r, 800));

            expect(callback).toHaveBeenCalled();
        }, 8000);
    });
});
