import * as fs from "node:fs";
import * as path from "node:path";

import * as vscode from "vscode";

import { parseUnifiedDiffHunks } from "./lib/diff.ts";
import type { IStatusDecoration } from "./lib/map.ts";
import { hunksToGutter } from "./lib/map.ts";
import { statusToDecoration } from "./lib/map.ts";
import { parsePorcelainStatus } from "./lib/porcelain.ts";
import type { IRunGitOptions, IRunGitResult } from "./lib/runGit.ts";
import { runGit } from "./lib/runGit.ts";

/**
 * Built-in Git plugin (subprocess extension, plugin-API only).
 *
 * Two features, both driven through stock `vscode` decoration APIs:
 *  - explorer: changed files are coloured + badged via a `FileDecorationProvider`;
 *  - editor: dirty-diff bars are painted via `TextEditorDecorationType`s whose
 *    `overviewRulerColor` the engine re-projects onto the gutter.
 *
 * Reliability is the point: every `git` call goes through {@link runGit} (which
 * never rejects), every event handler is wrapped, refreshes are debounced, and
 * any bad environment (no workspace, no repo, missing binary, non-zero exit)
 * degrades to "no decorations" plus a single log line — nothing escapes to the host.
 */

/** The three gutter colour ids, one decoration type each. */
const GUTTER_COLOR_IDS = [
    "editorGutter.addedBackground",
    "editorGutter.modifiedBackground",
    "editorGutter.deletedBackground",
] as const;

function log(message: string): void {
    // stdout of the subprocess is piped into the `extensions.host.stdout` log
    // channel (→ ./vexx.log in dev); it never touches the TUI pty.
    console.log(`[git] ${message}`);
}

/** A tracked resource: its porcelain code (for untracked detection) + tree decoration. */
interface IStatusEntry {
    readonly xy: string;
    readonly deco: IStatusDecoration;
}

class GitDecorations {
    private readonly repoRoot: string;
    private readonly gitEnv: NodeJS.ProcessEnv | undefined;
    private readonly disposables: vscode.Disposable[] = [];

    // Gutter decoration types, keyed by their `editorGutter.*` colour id.
    private readonly gutterTypes = new Map<string, vscode.TextEditorDecorationType>();

    // Tree status, keyed by absolute path. Drives both the file-decoration
    // provider and untracked-detection for the gutter.
    private status = new Map<string, IStatusEntry>();
    private readonly fileDecoEmitter = new vscode.EventEmitter<vscode.Uri[]>();

    private refreshTimer: ReturnType<typeof setTimeout> | undefined;
    private gitDirWatcher: fs.FSWatcher | undefined;
    #disposed = false;
    // Метод, а не поле/геттер: результат вызова TS не сужает, поэтому повторные проверки
    // после await не «залипают» (флаг может стать true во время асинхронной паузы).
    private isDisposed(): boolean {
        return this.#disposed;
    }

    // Whether we already logged a degraded git invocation this session (avoid spam).
    private loggedGitFailure = false;

    public constructor(repoRoot: string, gitEnv: NodeJS.ProcessEnv | undefined) {
        this.repoRoot = repoRoot;
        this.gitEnv = gitEnv;
        for (const colorId of GUTTER_COLOR_IDS) {
            const type = vscode.window.createTextEditorDecorationType({
                isWholeLine: true,
                overviewRulerLane: vscode.OverviewRulerLane.Left,
                overviewRulerColor: new vscode.ThemeColor(colorId),
            });
            this.gutterTypes.set(colorId, type);
            this.disposables.push(type);
        }
    }

    /** Wire providers, events and the initial refresh. Registers into `context.subscriptions`. */
    public start(context: vscode.ExtensionContext): void {
        this.disposables.push(this.fileDecoEmitter);

        this.disposables.push(
            vscode.window.registerFileDecorationProvider({
                onDidChangeFileDecorations: this.fileDecoEmitter.event,
                provideFileDecoration: (uri) => this.provideFileDecoration(uri),
            }),
        );

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => {
                this.guard("onDidChangeActiveTextEditor", () => {
                    this.scheduleRefresh();
                });
            }),
        );
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(() => {
                this.guard("onDidSaveTextDocument", () => {
                    this.scheduleRefresh();
                });
            }),
        );
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                this.guard("onDidChangeConfiguration", () => {
                    if (e.affectsConfiguration("git")) this.scheduleRefresh();
                });
            }),
        );

        this.watchGitDir();

        // The plugin owns its disposables; register a single umbrella disposable.
        context.subscriptions.push({
            dispose: () => {
                this.dispose();
            },
        });

        // Initial paint (async, never throws).
        void this.refreshAll();
    }

    private provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        try {
            if (!this.config().decorations) return undefined;
            const entry = this.status.get(uri.fsPath);
            if (entry === undefined) return undefined;
            return new vscode.FileDecoration(entry.deco.badge, undefined, new vscode.ThemeColor(entry.deco.colorId));
        } catch {
            return undefined;
        }
    }

    private config(): { master: boolean; decorations: boolean; gutter: boolean; debounce: number } {
        const cfg = vscode.workspace.getConfiguration("git");
        const master = cfg.get<boolean>("enabled", true);
        return {
            master,
            decorations: master && cfg.get<boolean>("decorations.enabled", true),
            gutter: master && cfg.get<boolean>("gutter.enabled", true),
            debounce: normalizeDebounce(cfg.get<number>("refreshDebounce", 200)),
        };
    }

    private scheduleRefresh(): void {
        if (this.isDisposed()) return;
        if (this.refreshTimer !== undefined) clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = undefined;
            void this.refreshAll();
        }, this.config().debounce);
    }

    private async refreshAll(): Promise<void> {
        await this.refreshStatus();
        await this.refreshActiveGutter();
    }

    /** Recompute `git status` → tree decorations. Clears everything when disabled/degraded. */
    private async refreshStatus(): Promise<void> {
        if (this.isDisposed()) return;
        const previous = new Set(this.status.keys());

        let next = new Map<string, IStatusEntry>();
        if (this.config().decorations) {
            const result = await this.git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
            if (result !== null) {
                for (const e of parsePorcelainStatus(Buffer.from(result.stdout, "utf8"))) {
                    next.set(path.join(this.repoRoot, e.path), { xy: e.xy, deco: statusToDecoration(e.xy) });
                }
            } else {
                next = new Map(); // degraded → no decorations
            }
        }

        this.status = next;
        // Fire for the union of old ∪ new so removed files get cleared too.
        const affected = new Set<string>([...previous, ...next.keys()]);
        if (affected.size > 0 && !this.isDisposed()) {
            this.fileDecoEmitter.fire([...affected].map((p) => vscode.Uri.file(p)));
        }
    }

    /** Recompute the active file's diff → gutter bars. Clears when disabled/degraded. */
    private async refreshActiveGutter(): Promise<void> {
        if (this.isDisposed()) return;
        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) return;

        const rangesByColor = new Map<string, vscode.Range[]>();
        for (const colorId of GUTTER_COLOR_IDS) rangesByColor.set(colorId, []);

        if (this.config().gutter) {
            const absPath = editor.document.fileName;
            if (this.isUnderRepo(absPath)) {
                const hunks = await this.computeHunks(absPath);
                for (const g of hunksToGutter(hunks)) {
                    const bucket = rangesByColor.get(g.colorId);
                    if (bucket === undefined) continue;
                    // lib ranges are inclusive 1-based; vscode.Range is 0-based.
                    bucket.push(new vscode.Range(g.range.startLine - 1, 0, g.range.endLine - 1, 0));
                }
            }
        }

        if (this.isDisposed()) return;
        for (const [colorId, ranges] of rangesByColor) {
            const type = this.gutterTypes.get(colorId);
            if (type !== undefined) editor.setDecorations(type, ranges);
        }
    }

    /** Hunks for one file: untracked → whole file added; otherwise `git diff -U0 HEAD`. */
    private async computeHunks(absPath: string): Promise<ReturnType<typeof parseUnifiedDiffHunks>> {
        const entry = this.status.get(absPath);
        if (entry?.xy.startsWith("?")) {
            const lineCount = countLines(absPath);
            return lineCount > 0 ? [{ start: 1, count: lineCount, kind: "added" as const }] : [];
        }
        const rel = path.relative(this.repoRoot, absPath);
        const result = await this.git(["diff", "--no-color", "-U0", "HEAD", "--", rel]);
        if (result === null) return [];
        return parseUnifiedDiffHunks(result.stdout);
    }

    /** Run git in the repo; returns a successful result or `null` (degraded — logged once). */
    private async git(args: string[]): Promise<IRunGitResult | null> {
        const opts: IRunGitOptions = { cwd: this.repoRoot };
        if (this.gitEnv !== undefined) opts.env = this.gitEnv;
        const result = await runGit(args, opts);
        if ("error" in result) {
            if (!this.loggedGitFailure) {
                this.loggedGitFailure = true;
                log(`git unavailable (${result.error.message}) — decorations disabled`);
            }
            return null;
        }
        if (result.code !== 0) {
            if (!this.loggedGitFailure) {
                this.loggedGitFailure = true;
                log(`git ${args[0]} exited ${result.code}: ${result.stderr.trim()}`);
            }
            return null;
        }
        return result;
    }

    private isUnderRepo(absPath: string): boolean {
        const rel = path.relative(this.repoRoot, absPath);
        return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
    }

    /** Watch `.git/HEAD` + `.git/index` (via the .git dir) to catch external git ops. */
    private watchGitDir(): void {
        try {
            const gitDir = path.join(this.repoRoot, ".git");
            if (!fs.statSync(gitDir, { throwIfNoEntry: false })?.isDirectory()) return;
            this.gitDirWatcher = fs.watch(gitDir, (_event, filename) => {
                if (filename === "HEAD" || filename === "index" || filename === null) {
                    this.guard("gitDirWatcher", () => {
                        this.scheduleRefresh();
                    });
                }
            });
            // A watcher error (e.g. inotify exhaustion) must not crash the plugin.
            this.gitDirWatcher.on("error", () => undefined);
        } catch {
            // No watcher — refresh still happens on save / editor switch.
        }
    }

    /** Run a handler, swallowing and logging any throw so nothing reaches the host. */
    private guard(where: string, fn: () => void): void {
        try {
            fn();
        } catch (err) {
            log(`handler ${where} failed: ${String(err)}`);
        }
    }

    public dispose(): void {
        if (this.isDisposed()) return;
        this.#disposed = true;
        if (this.refreshTimer !== undefined) clearTimeout(this.refreshTimer);
        this.gitDirWatcher?.close();
        for (const d of this.disposables.splice(0).reverse()) {
            try {
                d.dispose();
            } catch {
                // swallow
            }
        }
    }
}

function normalizeDebounce(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n < 0) return 200;
    return Math.min(n, 5000);
}

/** Count lines in a file (for the whole-file "added" gutter of untracked files). */
function countLines(absPath: string): number {
    try {
        const text = fs.readFileSync(absPath, "utf8");
        if (text === "") return 0;
        const lines = text.split("\n");
        // A trailing newline yields a spurious empty final element.
        if (lines[lines.length - 1] === "") lines.pop();
        return lines.length;
    } catch {
        return 0;
    }
}

/** Build the child-process env that prefers `git.path`'s directory, if configured. */
function gitEnvFor(gitPath: string): NodeJS.ProcessEnv | undefined {
    if (gitPath === "") return undefined;
    const dir = path.dirname(gitPath);
    const sep = path.delimiter;
    const currentPath = process.env.PATH ?? "";
    return { ...process.env, PATH: currentPath === "" ? dir : `${dir}${sep}${currentPath}` };
}

/** Resolve the enclosing git repository root, or `null` if none/unavailable. */
async function detectRepoRoot(cwd: string, gitEnv: NodeJS.ProcessEnv | undefined): Promise<string | null> {
    const opts: IRunGitOptions = { cwd };
    if (gitEnv !== undefined) opts.env = gitEnv;
    const result = await runGit(["rev-parse", "--show-toplevel"], opts);
    if ("error" in result || result.code !== 0) return null;
    const root = result.stdout.trim();
    return root === "" ? null : root;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        const folders = vscode.workspace.workspaceFolders;
        const cwd = folders?.[0]?.uri.fsPath;
        if (cwd === undefined) {
            log("no workspace folder — git integration inactive");
            return;
        }

        const gitPath = vscode.workspace.getConfiguration("git").get<string>("path", "");
        const gitEnv = gitEnvFor(gitPath);

        const repoRoot = await detectRepoRoot(cwd, gitEnv);
        if (repoRoot === null) {
            log(`not a git repository (or git unavailable): ${cwd}`);
            return;
        }

        log(`git integration active: ${repoRoot}`);
        const decorations = new GitDecorations(repoRoot, gitEnv);
        decorations.start(context);
    } catch (err) {
        // activate() must never throw into the host.
        log(`activate failed: ${String(err)}`);
    }
}
