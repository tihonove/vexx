#!/usr/bin/env node
/**
 * Упаковка рантайм-раскладки нативного `node-pty` в ассет `node-pty.bundle`.
 *
 * Нативный аддон (`pty.node`) нельзя вшить в JS-blob SEA — `process.dlopen`
 * требует файл на диске. Поэтому пакуем `package.json` + рантайм-JS (`lib/**`) +
 * нативы (`build/Release/*`) в тот же bundle-формат, что и `vexx.bundle`
 * (см. pack-assets.mjs), а на первом запуске `loadNodePty.ts` распаковывает
 * ассет в `os.tmpdir()` и грузит через `createRequire`.
 *
 * Виртуальные пути внутри бандла обязаны совпадать с ожиданиями
 * `src/Controllers/Terminal/loadNodePty.ts`: он распаковывает ассет в
 * `tmpdir()/vexx-embedded-pty-<size>/` и делает `require` из
 * `<targetDir>/node-pty` — значит каждая запись пакуется с префиксом
 * `node-pty/` (`node-pty/package.json`, `node-pty/lib/…`, `node-pty/build/Release/…`).
 *
 * Scope: только linux-x64. macOS (`prebuilds/darwin-*` spawn-helper + codesign)
 * и Windows (ConPTY-набор) сознательно не покрыты — их доведёт отдельная задача.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, posix, relative, resolve, sep } from "node:path";

import { packBundle } from "./pack-assets.mjs";

/** Рекурсивный обход каталога с фильтром; возвращает абсолютные пути к файлам. */
function walkFiles(rootDir, filter) {
    /** @type {string[]} */
    const out = [];
    /** @param {string} dir */
    function walk(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile() && filter(full)) out.push(full);
        }
    }
    walk(rootDir);
    return out;
}

/**
 * Собирает `node-pty.bundle` из рантайм-файлов node-pty.
 *
 * @param {{ repoRoot: string }} params
 * @returns {{ bundle: Buffer, inputs: { virtualPath: string, data: Buffer }[], nodePtyRoot: string }}
 */
export function buildNodePtyBundle({ repoRoot }) {
    // Резолвим относительно repoRoot, чтобы бандл собирался из node_modules сборки,
    // а не из места, где лежит этот скрипт.
    const requireFromRoot = createRequire(join(repoRoot, "package.json"));
    const nodePtyRoot = requireFromRoot.resolve("node-pty/package.json").replace(/package\.json$/, "");

    /** @type {{ virtualPath: string, data: Buffer }[]} */
    const inputs = [];
    const addFile = (absPath) => {
        const rel = relative(nodePtyRoot, absPath).split(sep).join(posix.sep);
        inputs.push({ virtualPath: `node-pty/${rel}`, data: readFileSync(absPath) });
    };

    // package.json — точка входа require (main/exports).
    addFile(join(nodePtyRoot, "package.json"));

    // lib/**: только рантайм-JS (без .map и *.test.js).
    const libFiles = walkFiles(
        join(nodePtyRoot, "lib"),
        (p) => p.endsWith(".js") && !p.endsWith(".test.js") && !p.endsWith(".js.map"),
    ).sort();
    for (const filePath of libFiles) addFile(filePath);

    // build/Release/*: нативный аддон (pty.node). На linux-x64 spawn-helper'а нет —
    // node-pty на Linux форкает сам; darwin/win-специфику не трогаем (см. шапку).
    const releaseDir = join(nodePtyRoot, "build", "Release");
    let releaseFiles;
    try {
        releaseFiles = walkFiles(releaseDir, () => true).sort();
    } catch {
        throw new Error(`[pack-node-pty] нет ${releaseDir} — соберите node-pty под текущую платформу`);
    }
    for (const filePath of releaseFiles) addFile(filePath);

    const bundle = packBundle(inputs);
    return { bundle, inputs, nodePtyRoot };
}

// Прямой запуск: `node scripts/pack-node-pty.mjs` → dist/node-pty.bundle.
if (import.meta.url === `file://${process.argv[1]}`) {
    const repoRoot = resolve(import.meta.dirname, "..");
    const dist = resolve(repoRoot, "dist");
    const { bundle, inputs, nodePtyRoot } = buildNodePtyBundle({ repoRoot });
    const outPath = join(dist, "node-pty.bundle");
    writeFileSync(outPath, bundle);
    console.error(
        `[pack-node-pty] ${outPath} (${(bundle.length / 1024).toFixed(1)} KB, ${inputs.length} entries; from ${nodePtyRoot})`,
    );
}
