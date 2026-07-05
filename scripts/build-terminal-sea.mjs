#!/usr/bin/env node
/**
 * Сборка спайк-демо встроенного терминала в один SEA-бинарь.
 *
 * Демонстрирует целевую упаковку нативного PTY (см. docs/TODO/IntegratedTerminal.md):
 *   1. esbuild бандлит demo-JS: @xterm/headless (чистый JS) вшивается внутрь,
 *      node-pty остаётся external (нативный — грузится в рантайме из tmp).
 *   2. Рантайм-раскладка node-pty (package.json + lib/** + build/Release/*) пакуется
 *      в ассет `node-pty.bundle` (тот же формат, что vexx.bundle).
 *   3. `node --build-sea` вшивает ассет в бинарь; на первом запуске loadNodePty.ts
 *      распаковывает его в os.tmpdir() и грузит через createRequire.
 *
 * Запуск: node scripts/build-terminal-sea.mjs  → dist-terminal/vexx-terminal
 */

import { build } from "esbuild";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, posix, relative, resolve, sep } from "node:path";

import { packBundle } from "./pack-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist-terminal");
const isWindows = process.platform === "win32";
const exeName = isWindows ? "vexx-terminal.exe" : "vexx-terminal";
const outputPath = join(dist, exeName);

mkdirSync(dist, { recursive: true });

// 1. Bundle demo JS — @xterm/headless внутрь, node-pty external (нативный).
const mainJs = join(dist, "terminal.js");
await build({
    entryPoints: [join(root, "src/demos/terminal/terminalHost.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "es2024",
    outfile: mainJs,
    external: ["node-pty"],
    logLevel: "info",
});
console.log(`[build-terminal-sea] Bundled demo → ${mainJs}`);

// 2. Pack node-pty runtime layout into an asset.
const nodePtyRoot = createRequire(import.meta.url).resolve("node-pty/package.json").replace(/package\.json$/, "");
const inputs = [];
const addFile = (absPath) => {
    const rel = relative(nodePtyRoot, absPath).split(sep).join(posix.sep);
    inputs.push({ virtualPath: `node-pty/${rel}`, data: readFileSync(absPath) });
};
const walk = (dir, filter) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full, filter);
        else if (entry.isFile() && filter(full)) addFile(full);
    }
};

addFile(join(nodePtyRoot, "package.json"));
// lib: только рантайм-JS (без .map и *.test.js).
walk(join(nodePtyRoot, "lib"), (p) => p.endsWith(".js") && !p.endsWith(".test.js") && !p.endsWith(".js.map"));
// build/Release: нативный аддон (pty.node) [+ spawn-helper на платформах, где он есть].
const releaseDir = join(nodePtyRoot, "build", "Release");
try {
    walk(releaseDir, () => true);
} catch {
    throw new Error(`[build-terminal-sea] нет ${releaseDir} — соберите node-pty под текущую платформу`);
}

const bundle = packBundle(inputs);
const bundlePath = join(dist, "node-pty.bundle");
writeFileSync(bundlePath, bundle);
console.log(
    `[build-terminal-sea] Packed node-pty: ${inputs.length} files → ${bundlePath} (${(bundle.length / 1024).toFixed(1)} KB)`,
);

// 3. SEA config + build.
const seaConfig = {
    main: mainJs,
    output: outputPath,
    mainFormat: "module",
    disableExperimentalSEAWarning: true,
    assets: { "node-pty.bundle": bundlePath },
};
const configPath = join(dist, "sea-config.json");
writeFileSync(configPath, JSON.stringify(seaConfig, null, 2));

const { execSync } = await import("node:child_process");
console.log(`> node --build-sea ${configPath}`);
execSync(`node --build-sea ${configPath}`, { stdio: "inherit", cwd: root });

const binStats = statSync(outputPath);
console.log(`\n[build-terminal-sea] Binary: ${outputPath} (${(binStats.size / 1024 / 1024).toFixed(1)} MB)`);
console.log("Run it:  ./dist-terminal/vexx-terminal   (Ctrl+Q quit, Ctrl+C → shell)");
