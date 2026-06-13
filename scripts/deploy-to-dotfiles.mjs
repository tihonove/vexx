#!/usr/bin/env node

// Builds the vexx SEA binary and deploys it into the user's dotfiles repo so it
// is available on PATH (the dotfiles put .dotfiles.scripts/ on PATH).
//
// What it does:
//   1. npm run build:sea   → dist/vexx
//   2. copy → <dotfiles>/.dotfiles.scripts/vexx
//   3. git add + commit + push in the dotfiles repo
//
// Usage:
//   node scripts/deploy-to-dotfiles.mjs [--no-build] [--no-commit] [--no-push]
//
// Config via env:
//   DOTFILES_DIR   dotfiles repo root         (default: ~/.dotfiles)
//   DOTFILES_BIN   subdir on PATH for the bin (default: .dotfiles.scripts)

import { execFileSync, execSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const doBuild = !args.has("--no-build");
const doCommit = !args.has("--no-commit");
const doPush = !args.has("--no-push");

const repoRoot = resolve(import.meta.dirname, "..");
const dotfilesDir = process.env.DOTFILES_DIR ?? join(homedir(), ".dotfiles");
const binSubdir = process.env.DOTFILES_BIN ?? ".dotfiles.scripts";
const binDir = join(dotfilesDir, binSubdir);

const exeSuffix = process.platform === "win32" ? ".exe" : "";
const sourceBinary = join(repoRoot, "dist", `vexx${exeSuffix}`);
const targetBinary = join(binDir, "vexx");

function fail(message) {
    console.error(`[deploy] ERROR: ${message}`);
    process.exit(1);
}

function git(cwd, ...gitArgs) {
    return execFileSync("git", gitArgs, { cwd, encoding: "utf8" }).trim();
}

// ── Preconditions ─────────────────────────────────────────────────────────────
if (!existsSync(dotfilesDir)) fail(`dotfiles dir not found: ${dotfilesDir} (set DOTFILES_DIR)`);
if (!existsSync(binDir)) fail(`bin dir not found: ${binDir} (set DOTFILES_BIN)`);
try {
    git(dotfilesDir, "rev-parse", "--is-inside-work-tree");
} catch {
    fail(`${dotfilesDir} is not a git repository`);
}

// ── 1. Build ──────────────────────────────────────────────────────────────────
if (doBuild) {
    console.log("> npm run build:sea");
    execSync("npm run build:sea", { stdio: "inherit", cwd: repoRoot });
} else {
    console.log("[deploy] --no-build: using existing dist/ binary");
}
if (!existsSync(sourceBinary)) fail(`built binary not found: ${sourceBinary}`);

// ── 2. Copy binary ────────────────────────────────────────────────────────────
copyFileSync(sourceBinary, targetBinary);
chmodSync(targetBinary, 0o755);
const sizeMb = (statSync(targetBinary).size / 1024 / 1024).toFixed(1);
console.log(`[deploy] ${sourceBinary} → ${targetBinary} (${sizeMb} MB)`);

// ── 3. Commit + push ──────────────────────────────────────────────────────────
if (!doCommit) {
    console.log(`[deploy] --no-commit: skipping git. Run 'vexx' (PATH includes ${binSubdir}).`);
    process.exit(0);
}

git(dotfilesDir, "add", "--", join(binSubdir, "vexx"));

let version = "unknown";
try {
    version = git(repoRoot, "rev-parse", "--short", "HEAD");
} catch {
    /* keep "unknown" */
}

// Commit only the staged vexx binary (ignore unrelated worktree noise such as
// submodule pointer drift). `diff --cached --quiet` exits non-zero when staged.
let hasStaged = false;
try {
    git(dotfilesDir, "diff", "--cached", "--quiet", "--", join(binSubdir, "vexx"));
} catch {
    hasStaged = true;
}

if (!hasStaged) {
    console.log("[deploy] No changes to commit (binary identical).");
} else {
    git(dotfilesDir, "commit", "-m", `vexx: update binary (vexx@${version})`, "--", join(binSubdir, "vexx"));
    console.log(`[deploy] committed in ${dotfilesDir}`);
}

if (doPush) {
    console.log("> git push");
    execFileSync("git", ["push"], { cwd: dotfilesDir, stdio: "inherit" });
    console.log("[deploy] pushed.");
} else {
    console.log("[deploy] --no-push: run 'git -C ~/.dotfiles push' when ready.");
}
