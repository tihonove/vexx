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
    });

    describe("activate()", () => {
        it("sets isIndexed to true after activate", () => {
            expect(service.isIndexed).toBe(false);
            service.activate(tmpDir);
            expect(service.isIndexed).toBe(true);
        });

        it("empty directory yields no results", () => {
            service.activate(tmpDir);
            expect(service.search("")).toHaveLength(0);
        });

        it("indexes flat list of files", () => {
            writeFile(tmpDir, "alpha.ts");
            writeFile(tmpDir, "beta.ts");
            writeFile(tmpDir, "gamma.ts");
            service.activate(tmpDir);

            const results = service.search("");
            const names = results.map((r) => r.entry.relativePath);
            expect(names).toContain("alpha.ts");
            expect(names).toContain("beta.ts");
            expect(names).toContain("gamma.ts");
        });

        it("indexes files recursively", () => {
            writeFile(tmpDir, "src/Controllers/AppController.ts");
            writeFile(tmpDir, "src/Common/DiContainer.ts");
            writeFile(tmpDir, "package.json");
            service.activate(tmpDir);

            const results = service.search("");
            const paths = results.map((r) => r.entry.relativePath);
            expect(paths).toContain("src/Controllers/AppController.ts");
            expect(paths).toContain("src/Common/DiContainer.ts");
            expect(paths).toContain("package.json");
        });

        it("relativePath always uses forward slashes", () => {
            writeFile(tmpDir, "a/b/c.ts");
            service.activate(tmpDir);

            const results = service.search("");
            for (const r of results) {
                expect(r.entry.relativePath).not.toContain("\\");
            }
        });

        it("relativePath is relative to rootPath (no leading slash)", () => {
            writeFile(tmpDir, "src/main.ts");
            service.activate(tmpDir);

            const results = service.search("");
            for (const r of results) {
                expect(r.entry.relativePath.startsWith("/")).toBe(false);
            }
        });

        it("absolutePath is an absolute path", () => {
            writeFile(tmpDir, "src/main.ts");
            service.activate(tmpDir);

            const results = service.search("");
            for (const r of results) {
                expect(path.isAbsolute(r.entry.absolutePath)).toBe(true);
            }
        });

        it("does not index directories, only files", () => {
            mkdir(tmpDir, "emptyDir");
            writeFile(tmpDir, "real.ts");
            service.activate(tmpDir);

            const results = service.search("");
            const paths = results.map((r) => r.entry.relativePath);
            expect(paths).not.toContain("emptyDir");
            expect(paths).toContain("real.ts");
        });
    });

    describe("exclusions", () => {
        it("EXCLUDED_FS_NAMES contains node_modules, .git, .DS_Store", () => {
            expect(EXCLUDED_FS_NAMES.has("node_modules")).toBe(true);
            expect(EXCLUDED_FS_NAMES.has(".git")).toBe(true);
            expect(EXCLUDED_FS_NAMES.has(".DS_Store")).toBe(true);
        });

        it("excludes node_modules directory", () => {
            writeFile(tmpDir, "node_modules/some-pkg/index.js");
            writeFile(tmpDir, "src/main.ts");
            service.activate(tmpDir);

            const paths = service.search("").map((r) => r.entry.relativePath);
            expect(paths.some((p) => p.includes("node_modules"))).toBe(false);
            expect(paths).toContain("src/main.ts");
        });

        it("excludes .git directory", () => {
            writeFile(tmpDir, ".git/COMMIT_EDITMSG");
            writeFile(tmpDir, "src/main.ts");
            service.activate(tmpDir);

            const paths = service.search("").map((r) => r.entry.relativePath);
            expect(paths.some((p) => p.includes(".git"))).toBe(false);
        });

        it("does not exclude files just because they start with a dot", () => {
            writeFile(tmpDir, ".eslintrc.json");
            service.activate(tmpDir);

            const paths = service.search("").map((r) => r.entry.relativePath);
            expect(paths).toContain(".eslintrc.json");
        });
    });

    describe("chokidar file watching", () => {
        it("calls onIndexChanged when a file is added", async () => {
            service.activate(tmpDir);
            const cb = vi.fn();
            service.onIndexChanged = cb;

            // Wait for chokidar to finish setting up its watchers
            await new Promise((resolve) => setTimeout(resolve, 500));

            writeFile(tmpDir, "new-file.ts");

            // Wait for debounce + FS event propagation
            await new Promise((resolve) => setTimeout(resolve, 1000));

            expect(cb).toHaveBeenCalled();
        }, 5000);

        it("adds new file to search results after fs event", async () => {
            service.activate(tmpDir);
            await new Promise((resolve) => setTimeout(resolve, 500));

            writeFile(tmpDir, "later.ts");
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const paths = service.search("").map((r) => r.entry.relativePath);
            expect(paths).toContain("later.ts");
        }, 5000);

        it("calls onIndexChanged when a file is deleted", async () => {
            const fileToDelete = writeFile(tmpDir, "to-delete.ts");
            service.activate(tmpDir);

            const cb = vi.fn();
            service.onIndexChanged = cb;

            // Wait for chokidar to be ready before deleting
            await new Promise((resolve) => setTimeout(resolve, 500));

            fs.unlinkSync(fileToDelete);
            await new Promise((resolve) => setTimeout(resolve, 1000));

            expect(cb).toHaveBeenCalled();
        }, 5000);

        it("removes deleted file from search results", async () => {
            const fileToDelete = writeFile(tmpDir, "to-delete.ts");
            service.activate(tmpDir);

            // Verify it's in the index before deletion
            let paths = service.search("").map((r) => r.entry.relativePath);
            expect(paths).toContain("to-delete.ts");

            await new Promise((resolve) => setTimeout(resolve, 500));
            fs.unlinkSync(fileToDelete);
            await new Promise((resolve) => setTimeout(resolve, 1000));

            paths = service.search("").map((r) => r.entry.relativePath);
            expect(paths).not.toContain("to-delete.ts");
        }, 5000);

        it("removes all files under a deleted directory", async () => {
            writeFile(tmpDir, "subdir/a.ts");
            writeFile(tmpDir, "subdir/b.ts");
            service.activate(tmpDir);

            let paths = service.search("").map((r) => r.entry.relativePath);
            expect(paths).toContain("subdir/a.ts");

            await new Promise((resolve) => setTimeout(resolve, 500));
            fs.rmSync(path.join(tmpDir, "subdir"), { recursive: true });
            await new Promise((resolve) => setTimeout(resolve, 1000));

            paths = service.search("").map((r) => r.entry.relativePath);
            expect(paths).not.toContain("subdir/a.ts");
            expect(paths).not.toContain("subdir/b.ts");
        }, 5000);
    });
});
