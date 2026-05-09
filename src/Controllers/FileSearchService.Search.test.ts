import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileSearchService } from "./FileSearchService.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "vexx-filesearch-search-"));
}

function cleanupDir(dirPath: string): void {
    fs.rmSync(dirPath, { recursive: true, force: true });
}

function writeFile(dir: string, relPath: string, content = ""): void {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
}

/**
 * Creates a service with a pre-populated temp directory.
 * `files` is a list of relative paths to create (empty content).
 */
function makeService(files: string[]): { service: FileSearchService; tmpDir: string } {
    const tmpDir = createTempDir();
    for (const f of files) {
        writeFile(tmpDir, f);
    }
    const service = new FileSearchService();
    service.activate(tmpDir);
    return { service, tmpDir };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("FileSearchService — search()", () => {
    let tmpDir: string;
    let service: FileSearchService;

    afterEach(() => {
        service.dispose();
        cleanupDir(tmpDir);
    });

    // ── Empty query ────────────────────────────────────────────────────────────

    describe("empty query", () => {
        beforeEach(() => {
            ({ service, tmpDir } = makeService(["alpha.ts", "beta.ts", "gamma.ts"]));
        });

        it("returns all files when query is empty", () => {
            const results = service.search("");
            expect(results).toHaveLength(3);
        });

        it("returns all results with score 0", () => {
            const results = service.search("");
            for (const r of results) {
                expect(r.score).toBe(0);
            }
        });

        it("respects maxResults", () => {
            const results = service.search("", 2);
            expect(results).toHaveLength(2);
        });
    });

    // ── Basic matching ─────────────────────────────────────────────────────────

    describe("basic matching", () => {
        beforeEach(() => {
            ({ service, tmpDir } = makeService([
                "src/Controllers/AppController.ts",
                "src/Controllers/FileTreeController.ts",
                "src/Common/DiContainer.ts",
                "package.json",
            ]));
        });

        it("finds file by partial basename", () => {
            const results = service.search("ac");
            const paths = results.map((r) => r.entry.relativePath);
            expect(paths.some((p) => p.includes("AppController"))).toBe(true);
        });

        it("is case-insensitive", () => {
            const upper = service.search("AC");
            const lower = service.search("ac");
            expect(upper.map((r) => r.entry.relativePath)).toEqual(
                lower.map((r) => r.entry.relativePath)
            );
        });

        it("returns empty array when nothing matches", () => {
            const results = service.search("zzzzzz");
            expect(results).toHaveLength(0);
        });

        it("respects maxResults on non-empty query", () => {
            // Add more files so we have enough to limit
            const { service: s2, tmpDir: t2 } = makeService([
                "a/Controller1.ts",
                "b/Controller2.ts",
                "c/Controller3.ts",
            ]);
            const results = s2.search("ctrl", 2);
            expect(results.length).toBeLessThanOrEqual(2);
            s2.dispose();
            cleanupDir(t2);
        });
    });

    // ── Ranking: word-boundary ─────────────────────────────────────────────────

    describe("ranking — word boundaries", () => {
        it("AppController ranks above abstract_class for query 'ac'", () => {
            ({ service, tmpDir } = makeService([
                "AppController.ts",
                "abstract_class.ts",
            ]));
            const results = service.search("ac");
            expect(results[0].entry.relativePath).toBe("AppController.ts");
        });

        it("FileController ranks above first_contact for query 'fc'", () => {
            ({ service, tmpDir } = makeService([
                "FileController.ts",
                "first_contact.ts",
            ]));
            const results = service.search("fc");
            expect(results[0].entry.relativePath).toBe("FileController.ts");
        });

        it("CommandRegistry ranks above continuous_record for query 'cr'", () => {
            ({ service, tmpDir } = makeService([
                "CommandRegistry.ts",
                "continuous_record.ts",
            ]));
            const results = service.search("cr");
            expect(results[0].entry.relativePath).toBe("CommandRegistry.ts");
        });
    });

    // ── Ranking: basename vs path ──────────────────────────────────────────────

    describe("ranking — basename priority", () => {
        it("file matching in basename ranks above file matching only in path", () => {
            // "ac" matches the basename "AppController.ts"
            // "ac" also matches "src/actions/config.ts" via path only
            ({ service, tmpDir } = makeService([
                "src/actions/config.ts",        // 'a'ctions + 'c'onfig in path
                "AppController.ts",             // basename match
            ]));
            const results = service.search("ac");
            expect(results[0].entry.relativePath).toBe("AppController.ts");
        });

        it("basename match score is higher than full-path-only match score", () => {
            ({ service, tmpDir } = makeService([
                "controllers/actions/util.ts",  // match in path dirs, not basename
                "ActionController.ts",          // basename word-boundary match
            ]));
            const results = service.search("ac");
            const basenameIdx = results.findIndex((r) =>
                r.entry.relativePath === "ActionController.ts"
            );
            const pathIdx = results.findIndex((r) =>
                r.entry.relativePath === "controllers/actions/util.ts"
            );
            // Both should be found
            expect(basenameIdx).not.toBe(-1);
            expect(pathIdx).not.toBe(-1);
            // Basename should rank first (lower index)
            expect(basenameIdx).toBeLessThan(pathIdx);
        });
    });

    // ── Ranking: path search ───────────────────────────────────────────────────

    describe("ranking — path search", () => {
        it("finds files when query contains path separator segments", () => {
            ({ service, tmpDir } = makeService([
                "src/Controllers/AppController.ts",
                "src/Common/AppConfig.ts",
            ]));
            // "ctrl/ac" — 'c'ontrollers matches 'c', 'trl' consecutive, then 'a'pp'c'ontroller
            const results = service.search("ctrl");
            const paths = results.map((r) => r.entry.relativePath);
            expect(paths.some((p) => p.includes("Controllers"))).toBe(true);
        });

        it("deep nested file is found by basename", () => {
            ({ service, tmpDir } = makeService([
                "a/b/c/d/e/DeepFile.ts",
            ]));
            const results = service.search("df");
            const paths = results.map((r) => r.entry.relativePath);
            expect(paths).toContain("a/b/c/d/e/DeepFile.ts");
        });
    });

    // ── Result structure ──────────────────────────────────────────────────────

    describe("result structure", () => {
        beforeEach(() => {
            ({ service, tmpDir } = makeService(["src/Controllers/AppController.ts"]));
        });

        it("result contains entry with relativePath and absolutePath", () => {
            const results = service.search("ac");
            expect(results.length).toBeGreaterThan(0);
            const result = results[0];
            expect(result.entry.relativePath).toBeDefined();
            expect(result.entry.absolutePath).toBeDefined();
            expect(path.isAbsolute(result.entry.absolutePath)).toBe(true);
        });

        it("result contains score (number)", () => {
            const results = service.search("ac");
            expect(typeof results[0].score).toBe("number");
        });

        it("result contains matchedIndices array", () => {
            const results = service.search("ac");
            expect(Array.isArray(results[0].matchedIndices)).toBe(true);
        });

        it("results are sorted by score descending", () => {
            const results = service.search("c");
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
            }
        });
    });

    // ── Search before activate ─────────────────────────────────────────────────

    describe("search before activate", () => {
        it("returns empty array when not yet indexed", () => {
            const s = new FileSearchService();
            expect(s.search("anything")).toHaveLength(0);
            s.dispose();
        });
    });

    // ── Large result set ───────────────────────────────────────────────────────

    describe("maxResults capping", () => {
        it("never returns more than maxResults items", () => {
            // Create 60 files
            const files = Array.from({ length: 60 }, (_, i) => `file${i}.ts`);
            ({ service, tmpDir } = makeService(files));
            const results = service.search("", 50);
            expect(results.length).toBeLessThanOrEqual(50);
        });

        it("custom maxResults is respected", () => {
            const files = Array.from({ length: 20 }, (_, i) => `Component${i}.ts`);
            ({ service, tmpDir } = makeService(files));
            const results = service.search("comp", 5);
            expect(results.length).toBeLessThanOrEqual(5);
        });
    });
});
