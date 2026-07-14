#!/usr/bin/env node
/**
 * Общая часть всех упаковок: `dist/main.js` + `dist/vexx.bundle`.
 *
 * Дальше форматы расходятся — SEA (`build-sea.mjs`) вшивает bundle в бинарь,
 * self-extract (`build-selfextract.mjs`) кладёт его файлом рядом с `main.js`, —
 * но исходные артефакты у них общие и собираются одинаково.
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildExtensions } from "./build-extensions.mjs";
import { buildVexxBundle } from "./pack-assets.mjs";

/**
 * Собирает `dist/main.js` и `dist/vexx.bundle`.
 *
 * @param {{ repoRoot: string }} params
 * @returns {Promise<{ distDir: string, mainJsPath: string, bundlePath: string }>}
 */
export async function buildDistArtifacts({ repoRoot }) {
    const distDir = join(repoRoot, "dist");
    mkdirSync(distDir, { recursive: true });

    // 1. Бандлим приложение в единственный dist/main.js (tsup, splitting: false).
    console.log("> npx tsup");
    execSync("npx tsup", { stdio: "inherit", cwd: repoRoot });

    // 2. Компилируем «кодовые» builtin'ы (git, …) → <dir>/out/extension.cjs ДО упаковки,
    // иначе скомпилированный entry не попадёт в vexx.bundle.
    const builtExtensions = await buildExtensions({ repoRoot });
    console.log(
        `[build-dist] Compiled ${builtExtensions.length} code-builtin(s): ${builtExtensions.map((b) => b.id).join(", ") || "—"}`,
    );

    // 3. Пакуем onig.wasm + src/Extensions/builtin/** в единый dist/vexx.bundle.
    const { bundle, inputs } = buildVexxBundle({ repoRoot });
    const bundlePath = join(distDir, "vexx.bundle");
    writeFileSync(bundlePath, bundle);
    console.log(`[build-dist] Packed ${inputs.length} assets → ${bundlePath} (${(bundle.length / 1024).toFixed(1)} KB)`);

    return { distDir, mainJsPath: join(distDir, "main.js"), bundlePath };
}
