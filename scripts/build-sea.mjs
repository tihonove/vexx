#!/usr/bin/env node

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
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

// 2. Generate SEA config
const seaConfig = {
    main: join(dist, "main.js"),
    output: outputPath,
    mainFormat: "module",
    disableExperimentalSEAWarning: true,
};

const configPath = join(dist, "sea-config.json");
writeFileSync(configPath, JSON.stringify(seaConfig, null, 2));
console.log(`SEA config written to ${configPath}`);

// 3. Build SEA binary
run(`node --build-sea ${configPath}`);

// 4. Sign on macOS (required for SEA to run)
if (isMac) {
    run(`codesign --sign - ${outputPath}`);
}

console.log(`\nDone! Binary: ${outputPath}`);
