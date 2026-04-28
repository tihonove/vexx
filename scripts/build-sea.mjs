#!/usr/bin/env node

import { execSync, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, cpSync, statSync } from "node:fs";
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

// 5. Verify the output is a proper binary (not just a blob)
const binStats = statSync(outputPath);
console.error(`[build-sea] Binary: ${outputPath} (${(binStats.size / 1024 / 1024).toFixed(1)} MB)`);

// 6. Sign on macOS (required for SEA to run)
if (isMac) {
    run(`chmod +x ${outputPath}`);

    // Show binary type for diagnostics
    try {
        const fileInfo = execSync(`file "${outputPath}"`, { encoding: "utf8", stdio: "pipe" }).trim();
        console.error(`[build-sea] file: ${fileInfo}`);
    } catch {}

    // Remove quarantine bit (set by macOS on some CI environments)
    try {
        execSync(`xattr -d com.apple.quarantine "${outputPath}"`, { stdio: "pipe" });
    } catch {
        // No quarantine attribute — that is fine.
    }

    // Remove any existing (potentially broken) signature left by postject before re-signing.
    try {
        execSync(`codesign --remove-signature "${outputPath}"`, { stdio: "pipe", cwd: root });
        console.error("[build-sea] Removed existing signature");
    } catch {
        // Binary may not have a signature yet — that is fine.
    }
    run(`codesign --sign - --force "${outputPath}"`);

    // Verify the new signature
    try {
        execSync(`codesign --verify --verbose "${outputPath}"`, { stdio: "inherit", cwd: root });
        console.error("[build-sea] Signature verified OK");
    } catch (e) {
        throw new Error(`[build-sea] Signature verification FAILED: ${String(e)}`);
    }

    // Confirm the binary is actually executable (catches EPERM / ENOEXEC early)
    {
        const testResult = spawnSync(outputPath, [], { timeout: 3000, stdio: "pipe", cwd: root });
        if (testResult.error) {
            const code = testResult.error.code ?? "";
            if (code === "ENOEXEC" || code === "EPERM" || code === "EACCES") {
                throw new Error(`[build-sea] Binary cannot be executed (${code}): ${testResult.error.message}`);
            }
            console.error(`[build-sea] Binary test error (spawn itself may have failed): ${code} — ${testResult.error.message}`);
        } else {
            console.error(`[build-sea] Binary test: spawn OK, exited with code ${String(testResult.status)}`);
        }
    }
}

console.log(`\nDone! Binary: ${outputPath}`);
