#!/usr/bin/env node
/**
 * Pack assets into `dist/vexx.bundle` for SEA-сборки.
 *
 * Формат бандла должен оставаться синхронным с
 * `src/Common/Assets/AssetBundleFormat.ts` — там лежит TS-decoder
 * (`BundleAssetAccess`). Намеренно дублируем 30 строк бинарного
 * формата здесь, чтобы build-pipeline не зависел от tsx/jiti.
 *
 * Layout:
 *   [magic 8B "VEXXBND\0"]
 *   [headerLength uint32 LE]
 *   [header JSON UTF-8]
 *   [data ...]
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, posix, relative, resolve, sep } from "node:path";

const MAGIC = Buffer.from([0x56, 0x45, 0x58, 0x58, 0x42, 0x4e, 0x44, 0x00]); // "VEXXBND\0"

/**
 * @typedef {{ virtualPath: string, data: Buffer }} PackInput
 */

/** @param {readonly PackInput[]} inputs */
export function packBundle(inputs) {
    const files = {};
    let dataSize = 0;
    for (const input of inputs) {
        validateVirtualPath(input.virtualPath);
        if (Object.prototype.hasOwnProperty.call(files, input.virtualPath)) {
            throw new Error(`Duplicate bundle entry: ${input.virtualPath}`);
        }
        files[input.virtualPath] = { offset: dataSize, size: input.data.length };
        dataSize += input.data.length;
    }
    const header = { version: 1, files };
    const headerJson = Buffer.from(JSON.stringify(header), "utf-8");

    const total = MAGIC.length + 4 + headerJson.length + dataSize;
    const out = Buffer.allocUnsafe(total);
    MAGIC.copy(out, 0);
    out.writeUInt32LE(headerJson.length, MAGIC.length);
    headerJson.copy(out, MAGIC.length + 4);

    let cursor = MAGIC.length + 4 + headerJson.length;
    for (const input of inputs) {
        input.data.copy(out, cursor);
        cursor += input.data.length;
    }
    return out;
}

/** @param {string} virtualPath */
function validateVirtualPath(virtualPath) {
    if (virtualPath.length === 0) throw new Error("Virtual path must not be empty");
    if (virtualPath.startsWith("/")) throw new Error(`Virtual path must not start with "/": ${virtualPath}`);
    if (virtualPath.endsWith("/")) throw new Error(`Virtual path must not end with "/": ${virtualPath}`);
    for (const segment of virtualPath.split("/")) {
        if (segment === "" || segment === "." || segment === "..") {
            throw new Error(`Invalid segment in virtual path: ${virtualPath}`);
        }
    }
}

/** Recursively walk a directory and yield absolute paths to files. */
function walkFiles(rootDir) {
    /** @type {string[]} */
    const out = [];
    /** @param {string} dir */
    function walk(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile()) out.push(full);
        }
    }
    walk(rootDir);
    return out;
}

/** Convert OS path inside `root` into a POSIX virtual path with given prefix. */
function toVirtualPath(prefix, root, absPath) {
    const rel = relative(root, absPath).split(sep).join(posix.sep);
    return `${prefix}${rel}`;
}

/**
 * Build the bundle from the standard set of inputs:
 *   - `onig.wasm` — resolved via require.resolve("vscode-oniguruma/release/onig.wasm")
 *   - `Extensions/builtin/**` — full recursive copy of `src/Extensions/builtin/`
 */
export function buildVexxBundle({ repoRoot }) {
    const builtinSrc = resolve(repoRoot, "src", "Extensions", "builtin");
    const require = createRequire(import.meta.url);
    const onigWasmPath = require.resolve("vscode-oniguruma/release/onig.wasm");

    /** @type {PackInput[]} */
    const inputs = [];
    inputs.push({ virtualPath: "onig.wasm", data: readFileSync(onigWasmPath) });

    const builtinFiles = walkFiles(builtinSrc).sort();
    for (const filePath of builtinFiles) {
        const virtualPath = toVirtualPath("Extensions/builtin/", builtinSrc, filePath);
        inputs.push({ virtualPath, data: readFileSync(filePath) });
    }

    const bundle = packBundle(inputs);
    return { bundle, inputs, onigWasmPath };
}

// Allow direct execution: `node scripts/pack-assets.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
    const repoRoot = resolve(import.meta.dirname, "..");
    const dist = resolve(repoRoot, "dist");
    const { bundle, inputs, onigWasmPath } = buildVexxBundle({ repoRoot });
    const outPath = join(dist, "vexx.bundle");
    writeFileSync(outPath, bundle);
    const wasmStat = statSync(onigWasmPath);
    console.error(
        `[pack-assets] ${outPath} (${(bundle.length / 1024).toFixed(1)} KB, ${inputs.length} entries; onig.wasm=${(
            wasmStat.size / 1024
        ).toFixed(1)} KB)`,
    );
}
