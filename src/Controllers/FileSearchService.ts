import * as fs from "node:fs";
import * as path from "node:path";

import chokidar, { type FSWatcher } from "chokidar";

import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import { fuzzyMatchBest } from "../Common/FuzzySearch.ts";

export const FileSearchServiceDIToken = token<FileSearchService>("FileSearchService");

export const EXCLUDED_FS_NAMES = new Set(["node_modules", ".git", ".DS_Store"]);

/** Basename bonus so that a match in the filename beats a match only in the path. */
const BASENAME_BONUS = 200;

export interface FileSearchEntry {
    relativePath: string;
    absolutePath: string;
}

export interface FileSearchResult {
    entry: FileSearchEntry;
    score: number;
    matchedIndices: readonly number[];
}

export class FileSearchService extends Disposable {
    public static dependencies = [] as const;

    private entries: FileSearchEntry[] = [];
    private rootPath: string | null = null;
    private watcher: FSWatcher | null = null;

    public isIndexed = false;

    /** Called whenever files are added or removed (after chokidar events). */
    public onIndexChanged: (() => void) | null = null;

    /** Build the initial file index and start watching for changes. */
    public activate(rootPath: string): void {
        this.rootPath = rootPath;
        this.entries = this.walkSync(rootPath);
        this.isIndexed = true;

        const watcher = chokidar.watch(rootPath, {
            depth: undefined,
            ignoreInitial: true,
            ignored: (filePath: string) => {
                const name = path.basename(filePath);
                return EXCLUDED_FS_NAMES.has(name);
            },
        });

        watcher.on("add", (absPath: string) => {
            const relativePath = this.toRelative(absPath);
            if (relativePath !== null) {
                this.entries.push({ relativePath, absolutePath: absPath });
                this.onIndexChanged?.();
            }
        });

        watcher.on("unlink", (absPath: string) => {
            const before = this.entries.length;
            this.entries = this.entries.filter((e) => e.absolutePath !== absPath);
            if (this.entries.length !== before) {
                this.onIndexChanged?.();
            }
        });

        watcher.on("addDir", (_absPath: string) => {
            // Directories are not stored in the index; nothing to do.
        });

        watcher.on("unlinkDir", (absPath: string) => {
            // Remove all entries under this directory.
            const prefix = absPath + path.sep;
            const before = this.entries.length;
            this.entries = this.entries.filter((e) => !e.absolutePath.startsWith(prefix));
            if (this.entries.length !== before) {
                this.onIndexChanged?.();
            }
        });

        this.watcher = watcher;
        this.register({
            dispose: () => {
                void watcher.close();
                this.watcher = null;
            },
        });
    }

    /**
     * Search the index for files matching `query`.
     *
     * - Empty query: returns first `maxResults` entries with score 0.
     * - Non-empty query: tries fuzzy match on the basename first (with bonus),
     *   falls back to matching the full relative path.  Results are sorted by
     *   score descending.
     */
    public search(query: string, maxResults = 50): FileSearchResult[] {
        if (!this.isIndexed) return [];

        if (query === "") {
            return this.entries.slice(0, maxResults).map((entry) => ({
                entry,
                score: 0,
                matchedIndices: [],
            }));
        }

        const results: FileSearchResult[] = [];

        for (const entry of this.entries) {
            const basename = path.posix.basename(entry.relativePath);

            // First try matching against the basename only
            const basenameMatch = fuzzyMatchBest(query, basename);
            if (basenameMatch !== null) {
                // Re-map indices from basename space to relativePath space
                const offset = entry.relativePath.length - basename.length;
                results.push({
                    entry,
                    score: basenameMatch.score + BASENAME_BONUS,
                    matchedIndices: basenameMatch.matchedIndices.map((i) => i + offset),
                });
                continue;
            }

            // Fall back to matching against the full relative path
            const pathMatch = fuzzyMatchBest(query, entry.relativePath);
            if (pathMatch !== null) {
                results.push({
                    entry,
                    score: pathMatch.score,
                    matchedIndices: pathMatch.matchedIndices,
                });
            }
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, maxResults);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private walkSync(dir: string): FileSearchEntry[] {
        const entries: FileSearchEntry[] = [];
        this.walkDir(dir, dir, entries);
        return entries;
    }

    private walkDir(rootPath: string, dir: string, out: FileSearchEntry[]): void {
        let dirents: fs.Dirent[];
        try {
            dirents = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const dirent of dirents) {
            if (EXCLUDED_FS_NAMES.has(dirent.name)) continue;

            const absPath = path.join(dir, dirent.name);

            if (dirent.isDirectory()) {
                this.walkDir(rootPath, absPath, out);
            } else if (dirent.isFile()) {
                out.push({
                    relativePath: this.toRelativePath(rootPath, absPath),
                    absolutePath: absPath,
                });
            }
        }
    }

    private toRelative(absPath: string): string | null {
        if (this.rootPath === null) return null;
        return this.toRelativePath(this.rootPath, absPath);
    }

    /** Converts absolute path to a POSIX-style relative path (always uses '/'). */
    private toRelativePath(rootPath: string, absPath: string): string {
        const rel = path.relative(rootPath, absPath);
        // Normalise to forward slashes on all platforms
        return rel.split(path.sep).join("/");
    }
}
