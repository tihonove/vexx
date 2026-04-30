#!/usr/bin/env node

import { execSync, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

import { buildVexxBundle } from "./pack-assets.mjs";

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

// 2. Pack onig.wasm + src/Extensions/builtin/** into a single dist/vexx.bundle
const { bundle, inputs } = buildVexxBundle({ repoRoot: root });
const bundlePath = join(dist, "vexx.bundle");
writeFileSync(bundlePath, bundle);
console.log(
    `[build-sea] Packed ${inputs.length} assets → ${bundlePath} (${(bundle.length / 1024).toFixed(1)} KB)`,
);

// 3. Generate SEA config
const seaConfig = {
    main: join(dist, "main.js"),
    output: outputPath,
    mainFormat: "module",
    disableExperimentalSEAWarning: true,
    assets: {
        "vexx.bundle": bundlePath,
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
    try {
        const lipoInfo = execSync(`lipo -info "${outputPath}" 2>&1`, { encoding: "utf8", stdio: "pipe" }).trim();
        console.error(`[build-sea] lipo: ${lipoInfo}`);
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
