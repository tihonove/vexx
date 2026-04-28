#!/usr/bin/env node

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, cpSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";
const exeName = isWindows ? "vexx.exe" : "vexx";
const outputPath = join(dist, exeName);

function run(cmd) {
    console.log(`> ${cmd}`);
    execSync(cmd, { stdio: "inherit", cwd: root });
}

// 1. Bundle with tsup
mkdirSync(dist, { recursive: true });
run("npx tsup");

// 2. Copy builtin extensions (grammars, manifests) next to the binary
cpSync(join(root, "src", "Extensions", "builtin"), join(dist, "Extensions", "builtin"), { recursive: true });
console.log("Copied src/Extensions/builtin → dist/Extensions/builtin");

// 3. Generate SEA config
const require = createRequire(import.meta.url);
const onigWasmPath = require.resolve("vscode-oniguruma/release/onig.wasm");

const seaConfig = {
    main: join(dist, "main.js"),
    output: outputPath,
    mainFormat: "module",
    disableExperimentalSEAWarning: true,
    assets: {
        "onig.wasm": onigWasmPath,
    },
};

const configPath = join(dist, "sea-config.json");
writeFileSync(configPath, JSON.stringify(seaConfig, null, 2));
console.log(`SEA config written to ${configPath}`);

// 4. Build SEA binary
run(`node --build-sea ${configPath}`);

// 5. Sign on macOS (required for SEA to run)
if (isMac) {
    run(`chmod +x ${outputPath}`);
    run(`codesign --sign - --force ${outputPath}`);
}

console.log(`\nDone! Binary: ${outputPath}`);
