import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "..", "..");
const binaryName = process.platform === "win32" ? "vexx.exe" : "vexx";
const binaryPath = resolve(repoRoot, "dist", binaryName);

let buildPromise: Promise<string> | null = null;

/**
 * Lazily build the SEA binary and return its absolute path.
 * Subsequent callers reuse the same promise — `npm run build:sea` runs at most once
 * per Vitest worker.
 */
export function getBinaryPath(): Promise<string> {
    if (buildPromise) return buildPromise;
    buildPromise = build();
    return buildPromise;
}

function build(): Promise<string> {
    return new Promise((resolvePromise, rejectPromise) => {
        const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
        const child = spawn(npmCmd, ["run", "build:sea"], {
            cwd: repoRoot,
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, CI: "1" },
            shell: process.platform === "win32",
        });
        let stderr = "";
        let stdout = "";
        child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });
        child.on("error", rejectPromise);
        child.on("exit", (code) => {
            if (code !== 0) {
                rejectPromise(new Error(`build:sea failed with code ${String(code)}\n${stderr || stdout}`));
                return;
            }
            if (!existsSync(binaryPath)) {
                rejectPromise(new Error(`build:sea succeeded but binary missing: ${binaryPath}`));
                return;
            }
            resolvePromise(binaryPath);
        });
    });
}
