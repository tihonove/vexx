/**
 * Кодемод миграции структуры src/ на vscode-подобную раскладку (docs/VSCODE_STRUCTURE_MIGRATION.md).
 *
 * Использование:
 *   node scripts/migration/codemod.mjs <mapping.mjs> [--dry]
 *
 * mapping.mjs экспортирует:
 *   export const moves = [
 *     ["src/Rendering/Grid.ts", "src/vs/tui/rendering/grid.ts"],   // файл → файл
 *     { dir: "src/Input", to: "src/vs/tui/input" },                // каталог целиком, basename → camelCase
 *     { dir: "src/Foo", to: "src/vs/foo", rename: "keep" },        // каталог без переименования basename
 *   ];
 *   export const stringPrefixes = [["src/Rendering/", "src/vs/tui/rendering/"]]; // необязательно
 *
 * Что делает:
 *  1. Разворачивает правила в план file→file. Для файловых правил автоматически
 *     подтягивает компаньонов (X.test.ts, X.*.test.ts(x), X.stories.ts, X.bench.ts,
 *     X.*.TestUtils.ts) в тот же целевой каталог с согласованным переименованием.
 *  2. Валидирует план (существование, коллизии) и выполняет git mv.
 *  3. Переписывает относительные import/export/vi.mock/new URL спецификаторы во всех
 *     .ts/.tsx файлах src/ и e2e/ (резолв от старого пути файла, маппинг, новый relative).
 *  4. Переписывает строковые упоминания repo-относительных путей ("src/...") в конфигах
 *     и комментариях по точному совпадению плана + stringPrefixes.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const mappingPath = args.find((a) => !a.startsWith("--"));
if (!mappingPath) {
    console.error("Usage: node scripts/migration/codemod.mjs <mapping.mjs> [--dry]");
    process.exit(1);
}

const mapping = await import(pathToFileURL(path.resolve(mappingPath)).href);
const rules = mapping.moves ?? [];
const stringPrefixes = mapping.stringPrefixes ?? [];

// ── camelCase-преобразование basename ────────────────────────────────────────
function camelSegment(seg) {
    if (!/^[A-Z]/.test(seg)) return seg;
    const run = seg.match(/^[A-Z]+/)[0];
    if (run.length === seg.length) return seg.toLowerCase(); // весь сегмент — аббревиатура
    if (run.length === 1) return seg[0].toLowerCase() + seg.slice(1);
    // TUIElement → tui + Element; IRange → i + Range
    const lower = run.slice(0, -1).toLowerCase();
    return lower + seg.slice(run.length - 1);
}

function camelBasename(name) {
    // "AppController.Find.TestUtils.ts" → сегменты по точкам, camelCase каждого, кроме расширений
    const parts = name.split(".");
    return parts.map((p, i) => (i === parts.length - 1 ? p : camelSegment(p))).join(".");
}

// ── Развёртка правил в план file→file ────────────────────────────────────────
/** @type {Map<string, string>} repo-relative old → new (posix) */
const plan = new Map();

function addMove(from, to) {
    const existing = plan.get(from);
    if (existing && existing !== to) throw new Error(`Conflicting rules for ${from}: ${existing} vs ${to}`);
    plan.set(from, to);
}

function listFilesRec(dir) {
    const out = [];
    for (const e of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) out.push(...listFilesRec(rel));
        else out.push(rel);
    }
    return out;
}

const companionRe = (base) =>
    new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.((.+\\.)?(test|stories|bench)|(.+\\.)?TestUtils)\\.(ts|tsx)$`);

for (const rule of rules) {
    if (Array.isArray(rule)) {
        const [from, to] = rule;
        addMove(from, to);
        // компаньоны: X.test.ts, X.Foo.test.ts, X.stories.ts, X.bench.ts, X.Foo.TestUtils.ts
        const dir = path.posix.dirname(from);
        const fromBase = path.posix.basename(from).replace(/\.(ts|tsx)$/, "");
        const toDir = path.posix.dirname(to);
        const toBase = path.posix.basename(to).replace(/\.(ts|tsx)$/, "");
        const re = companionRe(fromBase);
        if (!fs.existsSync(path.join(repoRoot, dir))) continue;
        for (const name of fs.readdirSync(path.join(repoRoot, dir))) {
            const m = name.match(re);
            if (!m) continue;
            const suffix = name.slice(fromBase.length); // ".Find.TestUtils.ts" / ".test.ts"
            const newSuffix = suffix
                .split(".")
                .map((p, i, arr) => (i === 0 || i === arr.length - 1 ? p : camelSegment(p)))
                .join(".");
            addMove(`${dir}/${name}`, `${toDir}/${toBase}${newSuffix}`);
        }
    } else {
        const { dir, to, rename = "camel" } = rule;
        for (const rel of listFilesRec(dir)) {
            const sub = rel.slice(dir.length + 1);
            const subDir = path.posix.dirname(sub);
            const base = path.posix.basename(sub);
            const newBase = rename === "camel" ? camelBasename(base) : base;
            const newRel = subDir === "." ? `${to}/${newBase}` : `${to}/${subDir}/${newBase}`;
            addMove(rel, newRel);
        }
    }
}

// ── Валидация ────────────────────────────────────────────────────────────────
const targets = new Map();
for (const [from, to] of plan) {
    if (!fs.existsSync(path.join(repoRoot, from))) throw new Error(`Source not found: ${from}`);
    if (targets.has(to)) throw new Error(`Target collision: ${to} ← ${from} and ${targets.get(to)}`);
    targets.set(to, from);
    if (fs.existsSync(path.join(repoRoot, to)) && !plan.has(to)) throw new Error(`Target already exists: ${to}`);
}

console.log(`Plan: ${plan.size} file moves`);
if (dry) {
    for (const [from, to] of [...plan].sort()) console.log(`  ${from} → ${to}`);
    process.exit(0);
}

// ── git mv ───────────────────────────────────────────────────────────────────
for (const [from, to] of plan) {
    fs.mkdirSync(path.join(repoRoot, path.posix.dirname(to)), { recursive: true });
    execFileSync("git", ["mv", from, to], { cwd: repoRoot });
}

// подчистить опустевшие каталоги (git mv не удаляет пустые не-git каталоги)
function pruneEmpty(dir) {
    const abs = path.join(repoRoot, dir);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        if (e.isDirectory()) pruneEmpty(`${dir}/${e.name}`);
    }
    if (fs.readdirSync(abs).length === 0) fs.rmdirSync(abs);
}
for (const from of plan.keys()) {
    let dir = path.posix.dirname(from);
    while (dir !== "src" && dir !== "." && dir !== "e2e") {
        pruneEmpty(dir);
        dir = path.posix.dirname(dir);
    }
}

// ── Переписывание импортов ───────────────────────────────────────────────────
const reverse = new Map([...plan].map(([f, t]) => [t, f]));

function* walkTs(dir) {
    const abs = path.join(repoRoot, dir);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) {
            if (e.name === "node_modules" || e.name === "builtin") continue; // builtin — свои import-графы, не трогаем
            yield* walkTs(rel);
        } else if (/\.(ts|tsx|mts|mjs)$/.test(e.name)) yield rel;
    }
}

const SPEC_RE = /((?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+|\bvi\.mock\(\s*|\bnew URL\(\s*|\bawait import\(\s*)(["']))([^"']+)(\2)/gm;

const scanRoots = ["src", "e2e"];
let rewrittenFiles = 0;
for (const root of scanRoots) {
    for (const rel of walkTs(root)) {
        const oldRel = reverse.get(rel) ?? rel;
        const abs = path.join(repoRoot, rel);
        const text = fs.readFileSync(abs, "utf8");
        let changed = false;
        let next = text.replace(SPEC_RE, (whole, prefix, _q, spec, _q2) => {
            if (!spec.startsWith("./") && !spec.startsWith("../")) return whole;
            const oldTargetAbs = path.posix.normalize(path.posix.join(path.posix.dirname(oldRel), spec));
            const newTargetAbs = plan.get(oldTargetAbs) ?? oldTargetAbs;
            let newSpec = path.posix.relative(path.posix.dirname(rel), newTargetAbs);
            if (!newSpec.startsWith(".")) newSpec = `./${newSpec}`;
            if (newSpec !== spec) changed = true;
            return `${prefix}${newSpec}${_q2}`;
        });
        // строковые упоминания repo-относительных путей (конфиги/комментарии)
        for (const [from, to] of plan) {
            if (next.includes(from)) {
                next = next.split(from).join(to);
                changed = true;
            }
        }
        for (const [from, to] of stringPrefixes) {
            if (next.includes(from)) {
                next = next.split(from).join(to);
                changed = true;
            }
        }
        if (changed) {
            fs.writeFileSync(abs, next);
            rewrittenFiles++;
        }
    }
}

// ── Конфиги с зашитыми путями ────────────────────────────────────────────────
const configFiles = [
    "package.json",
    "tsconfig.json",
    "tsup.config.ts",
    "vitest.config.ts",
    "vitest.e2e.config.ts",
    "vitest.perf.config.ts",
    "eslint.config.ts",
    "eslint.overrides.ts",
];
for (const rel of configFiles) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;
    let text = fs.readFileSync(abs, "utf8");
    let changed = false;
    for (const [from, to] of plan) {
        if (text.includes(from)) {
            text = text.split(from).join(to);
            changed = true;
        }
    }
    for (const [from, to] of stringPrefixes) {
        if (text.includes(from)) {
            text = text.split(from).join(to);
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(abs, text);
        rewrittenFiles++;
    }
}

// ── Предупреждение об остатках в исходных каталогах ──────────────────────────
const sourceDirs = new Set([...plan.keys()].map((f) => path.posix.dirname(f)));
for (const dir of sourceDirs) {
    const abs = path.join(repoRoot, dir);
    if (!fs.existsSync(abs)) continue;
    const left = fs.readdirSync(abs).filter((n) => /\.(ts|tsx)$/.test(n));
    if (left.length) console.warn(`WARN: ${dir} still contains: ${left.join(", ")}`);
}

console.log(`Moved ${plan.size} files, rewrote ${rewrittenFiles} files.`);
