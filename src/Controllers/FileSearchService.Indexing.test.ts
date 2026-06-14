import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXCLUDED_FS_NAMES, FileSearchService } from "./FileSearchService.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "vexx-filesearch-index-"));
}

function cleanupDir(dirPath: string): void {
    fs.rmSync(dirPath, { recursive: true, force: true });
}

function writeFile(dir: string, relPath: string, content = ""): string {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    return fullPath;
}

function mkdir(dir: string, relPath: string): string {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(fullPath, { recursive: true });
    return fullPath;
}

function indexedPaths(service: FileSearchService): string[] {
    return service.search("").map((r) => r.entry.relativePath);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("FileSearchService — indexing", () => {
    let tmpDir: string;
    let service: FileSearchService;

    beforeEach(() => {
        tmpDir = createTempDir();
        service = new FileSearchService();
    });

    afterEach(() => {
        service.dispose();
        cleanupDir(tmpDir);
        vi.useRealTimers();
    });

    describe("activate()", () => {
        it("sets isIndexed to true after the initial walk completes", async () => {
            expect(service.isIndexed).toBe(false);
            await service.activate(tmpDir);
            expect(service.isIndexed).toBe(true);
        });

        it("activate() returns the same promise as `ready`", async () => {
            const p = service.activate(tmpDir);
            await service.ready;
            await p;
            expect(service.isIndexed).toBe(true);
        });

        it("empty directory yields no results", async () => {
            await service.activate(tmpDir);
            expect(service.search("")).toHaveLength(0);
        });

        it("indexes flat list of files", async () => {
            writeFile(tmpDir, "alpha.ts");
            writeFile(tmpDir, "beta.ts");
            writeFile(tmpDir, "gamma.ts");
            await service.activate(tmpDir);

            const names = indexedPaths(service);
            expect(names).toContain("alpha.ts");
            expect(names).toContain("beta.ts");
            expect(names).toContain("gamma.ts");
        });

        it("indexes files recursively", async () => {
            writeFile(tmpDir, "src/Controllers/AppController.ts");
            writeFile(tmpDir, "src/Common/DiContainer.ts");
            writeFile(tmpDir, "package.json");
            await service.activate(tmpDir);

            const paths = indexedPaths(service);
            expect(paths).toContain("src/Controllers/AppController.ts");
            expect(paths).toContain("src/Common/DiContainer.ts");
            expect(paths).toContain("package.json");
        });

        it("relativePath always uses forward slashes", async () => {
            writeFile(tmpDir, "a/b/c.ts");
            await service.activate(tmpDir);

            for (const p of indexedPaths(service)) {
                expect(p).not.toContain("\\");
            }
        });

        it("relativePath is relative to rootPath (no leading slash)", async () => {
            writeFile(tmpDir, "src/main.ts");
            await service.activate(tmpDir);

            for (const p of indexedPaths(service)) {
                expect(p.startsWith("/")).toBe(false);
            }
        });

        it("absolutePath is an absolute path", async () => {
            writeFile(tmpDir, "src/main.ts");
            await service.activate(tmpDir);

            for (const r of service.search("")) {
                expect(path.isAbsolute(r.entry.absolutePath)).toBe(true);
            }
        });

        it("does not index directories, only files", async () => {
            mkdir(tmpDir, "emptyDir");
            writeFile(tmpDir, "real.ts");
            await service.activate(tmpDir);

            const paths = indexedPaths(service);
            expect(paths).not.toContain("emptyDir");
            expect(paths).toContain("real.ts");
        });

        it("tolerates a non-existent root (resolves, empty index)", async () => {
            await service.activate(path.join(tmpDir, "does-not-exist"));
            expect(service.isIndexed).toBe(true);
            expect(service.search("")).toHaveLength(0);
        });
    });

    describe("background / cancellation", () => {
        it("a dispose before the walk runs cancels indexing", async () => {
            writeFile(tmpDir, "a.ts");
            writeFile(tmpDir, "b.ts");
            const pending = service.activate(tmpDir);
            service.dispose();
            await pending;

            expect(service.isIndexed).toBe(false);
            expect(service.search("")).toHaveLength(0);
        });

        it("a newer activate supersedes an in-flight one", async () => {
            writeFile(tmpDir, "a.ts");
            const first = service.activate(tmpDir);
            const second = service.activate(tmpDir);
            await Promise.all([first, second]);

            expect(service.isIndexed).toBe(true);
            expect(indexedPaths(service)).toContain("a.ts");
        });
    });

    describe("refreshIfStale()", () => {
        it("is a no-op before activate (no root)", () => {
            expect(() => service.refreshIfStale()).not.toThrow();
            expect(service.search("")).toHaveLength(0);
        });

        it("does nothing while the index is still fresh", async () => {
            writeFile(tmpDir, "a.ts");
            await service.activate(tmpDir);

            // Add a file but do not advance time — refresh should skip (throttled).
            writeFile(tmpDir, "b.ts");
            service.refreshIfStale();
            await service.ready;

            const paths = indexedPaths(service);
            expect(paths).toContain("a.ts");
            expect(paths).not.toContain("b.ts");
        });

        it("does nothing after dispose", async () => {
            await service.activate(tmpDir);
            service.dispose();
            expect(() => service.refreshIfStale()).not.toThrow();
        });

        it("re-walks and picks up new files once stale", async () => {
            writeFile(tmpDir, "a.ts");
            await service.activate(tmpDir);
            const base = Date.now();

            writeFile(tmpDir, "b.ts");

            // Jump the clock forward past the staleness window (fake Date only,
            // leaving setImmediate/setTimeout real so the walk still runs).
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(new Date(base + 60_000));

            service.refreshIfStale();
            await service.ready;

            const paths = indexedPaths(service);
            expect(paths).toContain("a.ts");
            expect(paths).toContain("b.ts");
        });
    });

    describe("re-index reflects filesystem changes", () => {
        it("a removed file is gone after re-activate", async () => {
            const removed = writeFile(tmpDir, "to-delete.ts");
            writeFile(tmpDir, "keep.ts");
            await service.activate(tmpDir);
            expect(indexedPaths(service)).toContain("to-delete.ts");

            fs.unlinkSync(removed);
            await service.activate(tmpDir);

            const paths = indexedPaths(service);
            expect(paths).not.toContain("to-delete.ts");
            expect(paths).toContain("keep.ts");
        });
    });

    describe("exclusions", () => {
        it("EXCLUDED_FS_NAMES contains node_modules, .git, .DS_Store", () => {
            expect(EXCLUDED_FS_NAMES.has("node_modules")).toBe(true);
            expect(EXCLUDED_FS_NAMES.has(".git")).toBe(true);
            expect(EXCLUDED_FS_NAMES.has(".DS_Store")).toBe(true);
        });

        it("excludes node_modules directory", async () => {
            writeFile(tmpDir, "node_modules/some-pkg/index.js");
            writeFile(tmpDir, "src/main.ts");
            await service.activate(tmpDir);

            const paths = indexedPaths(service);
            expect(paths.some((p) => p.includes("node_modules"))).toBe(false);
            expect(paths).toContain("src/main.ts");
        });

        it("excludes .git directory", async () => {
            writeFile(tmpDir, ".git/COMMIT_EDITMSG");
            writeFile(tmpDir, "src/main.ts");
            await service.activate(tmpDir);

            const paths = indexedPaths(service);
            expect(paths.some((p) => p.includes(".git"))).toBe(false);
        });

        it("does not exclude files just because they start with a dot", async () => {
            writeFile(tmpDir, ".eslintrc.json");
            await service.activate(tmpDir);

            const paths = indexedPaths(service);
            expect(paths).toContain(".eslintrc.json");
        });
    });
});
