"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// extensions/git/main.ts
var main_exports = {};
__export(main_exports, {
  activate: () => activate
});
module.exports = __toCommonJS(main_exports);
var fs = __toESM(require("node:fs"), 1);
var path = __toESM(require("node:path"), 1);
var vscode = __toESM(require("vscode"), 1);

// extensions/git/lib/diff.ts
var HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
function parseUnifiedDiffHunks(text) {
  const hunks = [];
  for (const line of text.split("\n")) {
    const match = HUNK_HEADER.exec(line);
    if (!match) continue;
    const oldCount = match[2] !== void 0 ? Number(match[2]) : 1;
    const newStart = Number(match[3]);
    const newCount = match[4] !== void 0 ? Number(match[4]) : 1;
    if (oldCount === 0) {
      hunks.push({ start: newStart, count: newCount, kind: "added" });
    } else if (newCount === 0) {
      hunks.push({ start: newStart, count: 1, kind: "deleted" });
    } else {
      hunks.push({ start: newStart, count: newCount, kind: "modified" });
    }
  }
  return hunks;
}

// extensions/git/lib/map.ts
var DECORATION_BY_STATUS = {
  M: { badge: "M", colorId: "gitDecoration.modifiedResourceForeground" },
  A: { badge: "A", colorId: "gitDecoration.addedResourceForeground" },
  D: { badge: "D", colorId: "gitDecoration.deletedResourceForeground" },
  R: { badge: "R", colorId: "gitDecoration.renamedResourceForeground" },
  C: { badge: "C", colorId: "gitDecoration.renamedResourceForeground" },
  "?": { badge: "U", colorId: "gitDecoration.untrackedResourceForeground" },
  "!": { badge: "I", colorId: "gitDecoration.ignoredResourceForeground" },
  U: { badge: "U", colorId: "gitDecoration.conflictingResourceForeground" }
};
var UNMERGED_CODES = /* @__PURE__ */ new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);
var GUTTER_COLOR_BY_KIND = {
  added: "editorGutter.addedBackground",
  modified: "editorGutter.modifiedBackground",
  deleted: "editorGutter.deletedBackground"
};
function statusToDecoration(xy) {
  const code = primaryStatusChar(xy);
  return DECORATION_BY_STATUS[code] ?? DECORATION_BY_STATUS.M;
}
function primaryStatusChar(xy) {
  if (xy === "??") return "?";
  if (xy === "!!") return "!";
  if (UNMERGED_CODES.has(xy)) return "U";
  const x = xy[0];
  return x !== " " ? x : xy[1];
}
function hunksToGutter(hunks) {
  return hunks.map((hunk) => ({
    range: { startLine: hunk.start, endLine: hunk.start + hunk.count - 1 },
    colorId: GUTTER_COLOR_BY_KIND[hunk.kind]
  }));
}

// extensions/git/lib/porcelain.ts
function parsePorcelainStatus(buf) {
  const fields = splitNul(buf);
  const entries = [];
  let i = 0;
  while (i < fields.length) {
    const record = fields[i];
    const xy = record.slice(0, 2);
    entries.push({ path: record.slice(3), xy });
    i += hasOriginalPath(xy) ? 2 : 1;
  }
  return entries;
}
function splitNul(buf) {
  const fields = [];
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0) {
      fields.push(buf.toString("utf8", start, i));
      start = i + 1;
    }
  }
  if (start < buf.length) fields.push(buf.toString("utf8", start));
  return fields;
}
function hasOriginalPath(xy) {
  return xy.includes("R") || xy.includes("C");
}

// extensions/git/lib/runGit.ts
var import_node_child_process = require("node:child_process");
var DEFAULT_TIMEOUT_MS = 3e4;
var inFlight = /* @__PURE__ */ new Map();
function runGit(args, opts = {}) {
  const key = JSON.stringify([opts.cwd ?? "", args]);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = spawnGit(args, opts).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
function spawnGit(args, opts) {
  return new Promise((resolve) => {
    const child = (0, import_node_child_process.spawn)("git", args, { cwd: opts.cwd, env: opts.env });
    const stdout = [];
    const stderr = [];
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => finish({ error }));
    child.on(
      "close",
      (code) => finish({
        code: code ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      })
    );
  });
}

// extensions/git/main.ts
var GUTTER_COLOR_IDS = [
  "editorGutter.addedBackground",
  "editorGutter.modifiedBackground",
  "editorGutter.deletedBackground"
];
function log(message) {
  console.log(`[git] ${message}`);
}
var GitDecorations = class {
  repoRoot;
  gitEnv;
  disposables = [];
  // Gutter decoration types, keyed by their `editorGutter.*` colour id.
  gutterTypes = /* @__PURE__ */ new Map();
  // Tree status, keyed by absolute path. Drives both the file-decoration
  // provider and untracked-detection for the gutter.
  status = /* @__PURE__ */ new Map();
  fileDecoEmitter = new vscode.EventEmitter();
  refreshTimer;
  gitDirWatcher;
  disposed = false;
  // Whether we already logged a degraded git invocation this session (avoid spam).
  loggedGitFailure = false;
  constructor(repoRoot, gitEnv) {
    this.repoRoot = repoRoot;
    this.gitEnv = gitEnv;
    for (const colorId of GUTTER_COLOR_IDS) {
      const type = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        overviewRulerLane: vscode.OverviewRulerLane.Left,
        overviewRulerColor: new vscode.ThemeColor(colorId)
      });
      this.gutterTypes.set(colorId, type);
      this.disposables.push(type);
    }
  }
  /** Wire providers, events and the initial refresh. Registers into `context.subscriptions`. */
  start(context) {
    this.disposables.push(this.fileDecoEmitter);
    this.disposables.push(
      vscode.window.registerFileDecorationProvider({
        onDidChangeFileDecorations: this.fileDecoEmitter.event,
        provideFileDecoration: (uri) => this.provideFileDecoration(uri)
      })
    );
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.guard("onDidChangeActiveTextEditor", () => this.scheduleRefresh());
      })
    );
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(() => {
        this.guard("onDidSaveTextDocument", () => this.scheduleRefresh());
      })
    );
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        this.guard("onDidChangeConfiguration", () => {
          if (e.affectsConfiguration("git")) this.scheduleRefresh();
        });
      })
    );
    this.watchGitDir();
    context.subscriptions.push({ dispose: () => this.dispose() });
    void this.refreshAll();
  }
  provideFileDecoration(uri) {
    try {
      if (!this.config().decorations) return void 0;
      const entry = this.status.get(uri.fsPath);
      if (entry === void 0) return void 0;
      return new vscode.FileDecoration(entry.deco.badge, void 0, new vscode.ThemeColor(entry.deco.colorId));
    } catch {
      return void 0;
    }
  }
  config() {
    const cfg = vscode.workspace.getConfiguration("git");
    const master = cfg.get("enabled", true);
    return {
      master,
      decorations: master && cfg.get("decorations.enabled", true),
      gutter: master && cfg.get("gutter.enabled", true),
      debounce: normalizeDebounce(cfg.get("refreshDebounce", 200))
    };
  }
  scheduleRefresh() {
    if (this.disposed) return;
    if (this.refreshTimer !== void 0) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = void 0;
      void this.refreshAll();
    }, this.config().debounce);
  }
  async refreshAll() {
    await this.refreshStatus();
    await this.refreshActiveGutter();
  }
  /** Recompute `git status` → tree decorations. Clears everything when disabled/degraded. */
  async refreshStatus() {
    if (this.disposed) return;
    const previous = new Set(this.status.keys());
    let next = /* @__PURE__ */ new Map();
    if (this.config().decorations) {
      const result = await this.git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
      if (result !== null) {
        for (const e of parsePorcelainStatus(Buffer.from(result.stdout, "utf8"))) {
          next.set(path.join(this.repoRoot, e.path), { xy: e.xy, deco: statusToDecoration(e.xy) });
        }
      } else {
        next = /* @__PURE__ */ new Map();
      }
    }
    this.status = next;
    const affected = /* @__PURE__ */ new Set([...previous, ...next.keys()]);
    if (affected.size > 0 && !this.disposed) {
      this.fileDecoEmitter.fire([...affected].map((p) => vscode.Uri.file(p)));
    }
  }
  /** Recompute the active file's diff → gutter bars. Clears when disabled/degraded. */
  async refreshActiveGutter() {
    if (this.disposed) return;
    const editor = vscode.window.activeTextEditor;
    if (editor === void 0) return;
    const rangesByColor = /* @__PURE__ */ new Map();
    for (const colorId of GUTTER_COLOR_IDS) rangesByColor.set(colorId, []);
    if (this.config().gutter) {
      const absPath = editor.document.fileName;
      if (this.isUnderRepo(absPath)) {
        const hunks = await this.computeHunks(absPath);
        for (const g of hunksToGutter(hunks)) {
          const bucket = rangesByColor.get(g.colorId);
          if (bucket === void 0) continue;
          bucket.push(new vscode.Range(g.range.startLine - 1, 0, g.range.endLine - 1, 0));
        }
      }
    }
    if (this.disposed) return;
    for (const [colorId, ranges] of rangesByColor) {
      const type = this.gutterTypes.get(colorId);
      if (type !== void 0) editor.setDecorations(type, ranges);
    }
  }
  /** Hunks for one file: untracked → whole file added; otherwise `git diff -U0 HEAD`. */
  async computeHunks(absPath) {
    const entry = this.status.get(absPath);
    if (entry !== void 0 && entry.xy.startsWith("?")) {
      const lineCount = countLines(absPath);
      return lineCount > 0 ? [{ start: 1, count: lineCount, kind: "added" }] : [];
    }
    const rel = path.relative(this.repoRoot, absPath);
    const result = await this.git(["diff", "--no-color", "-U0", "HEAD", "--", rel]);
    if (result === null) return [];
    return parseUnifiedDiffHunks(result.stdout);
  }
  /** Run git in the repo; returns a successful result or `null` (degraded — logged once). */
  async git(args) {
    const opts = { cwd: this.repoRoot };
    if (this.gitEnv !== void 0) opts.env = this.gitEnv;
    const result = await runGit(args, opts);
    if ("error" in result) {
      if (!this.loggedGitFailure) {
        this.loggedGitFailure = true;
        log(`git unavailable (${result.error.message}) \u2014 decorations disabled`);
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
  isUnderRepo(absPath) {
    const rel = path.relative(this.repoRoot, absPath);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
  }
  /** Watch `.git/HEAD` + `.git/index` (via the .git dir) to catch external git ops. */
  watchGitDir() {
    try {
      const gitDir = path.join(this.repoRoot, ".git");
      if (!fs.statSync(gitDir, { throwIfNoEntry: false })?.isDirectory()) return;
      this.gitDirWatcher = fs.watch(gitDir, (_event, filename) => {
        if (filename === "HEAD" || filename === "index" || filename === null) {
          this.guard("gitDirWatcher", () => this.scheduleRefresh());
        }
      });
      this.gitDirWatcher.on("error", () => void 0);
    } catch {
    }
  }
  /** Run a handler, swallowing and logging any throw so nothing reaches the host. */
  guard(where, fn) {
    try {
      fn();
    } catch (err) {
      log(`handler ${where} failed: ${String(err)}`);
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.refreshTimer !== void 0) clearTimeout(this.refreshTimer);
    this.gitDirWatcher?.close();
    for (const d of this.disposables.splice(0).reverse()) {
      try {
        d.dispose();
      } catch {
      }
    }
  }
};
function normalizeDebounce(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 200;
  return Math.min(n, 5e3);
}
function countLines(absPath) {
  try {
    const text = fs.readFileSync(absPath, "utf8");
    if (text === "") return 0;
    const lines = text.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    return lines.length;
  } catch {
    return 0;
  }
}
function gitEnvFor(gitPath) {
  if (gitPath === "") return void 0;
  const dir = path.dirname(gitPath);
  const sep = path.delimiter;
  const currentPath = process.env.PATH ?? "";
  return { ...process.env, PATH: currentPath === "" ? dir : `${dir}${sep}${currentPath}` };
}
async function detectRepoRoot(cwd, gitEnv) {
  const opts = { cwd };
  if (gitEnv !== void 0) opts.env = gitEnv;
  const result = await runGit(["rev-parse", "--show-toplevel"], opts);
  if ("error" in result || result.code !== 0) return null;
  const root = result.stdout.trim();
  return root === "" ? null : root;
}
async function activate(context) {
  try {
    const folders = vscode.workspace.workspaceFolders;
    const cwd = folders?.[0]?.uri.fsPath;
    if (cwd === void 0) {
      log("no workspace folder \u2014 git integration inactive");
      return;
    }
    const gitPath = vscode.workspace.getConfiguration("git").get("path", "");
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
    log(`activate failed: ${String(err)}`);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate
});
