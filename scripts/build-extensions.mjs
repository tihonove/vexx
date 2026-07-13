#!/usr/bin/env node
/**
 * Компиляция «кодовых» builtin-расширений в один CJS-файл `<dir>/out/extension.cjs`.
 *
 * Кодовый builtin — подкаталог `src/Extensions/builtin/*` с исходником `main.ts`
 * (языковые паки его не имеют — только грамматики/конфиги). esbuild бандлит
 * `main.ts` + `./lib/*` в один файл; `vscode` остаётся external (его в subprocess'е
 * подменяет `installVscodeStub`), node:builtins — тоже external (`platform:"node"`).
 * Поэтому в бандле не остаётся ни одного относительного `require` — файл грузится
 * в память через `Module._compile` без реального пути (dev и SEA единообразно).
 *
 * Раннер: `node scripts/build-extensions.mjs`. Также вызывается из `build-sea.mjs`
 * ДО упаковки бандла, чтобы `out/extension.cjs` попал в `vexx.bundle`.
 */

import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { build } from "esbuild";

import { generateSettingsSchema } from "./generate-settings-schema.mjs";

/** Имя скомпилированного entry внутри каталога расширения (совпадает с `main` в манифесте). */
export const COMPILED_BUILTIN_ENTRY = "out/extension.cjs";

/** Исходный entry кодового builtin по конвенции. */
const SOURCE_ENTRY = "main.ts";

/**
 * Скомпилировать все кодовые builtin-расширения. Возвращает список
 * `{ id, entryPoint, outfile }` собранных.
 */
export async function buildExtensions({ repoRoot }) {
    const builtinDir = resolve(repoRoot, "src", "Extensions", "builtin");
    // Генерируем каталог ключей настроек ДО esbuild — `vexx-settings/main.ts`
    // импортирует `settings-schema.generated.ts`, который бандлится в out/extension.cjs.
    await generateSettingsSchema({ repoRoot });
    const built = [];
    for (const entry of readdirSync(builtinDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const dir = join(builtinDir, entry.name);
        const entryPoint = join(dir, SOURCE_ENTRY);
        if (!statSync(entryPoint, { throwIfNoEntry: false })?.isFile()) continue; // не кодовый builtin
        const outfile = join(dir, COMPILED_BUILTIN_ENTRY);
        await build({
            entryPoints: [entryPoint],
            outfile,
            platform: "node",
            format: "cjs",
            bundle: true,
            target: "es2024",
            external: ["vscode"],
            sourcemap: false,
            logLevel: "warning",
        });
        built.push({ id: entry.name, entryPoint, outfile });
    }
    return built;
}

// Прямой запуск: `node scripts/build-extensions.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
    const repoRoot = resolve(import.meta.dirname, "..");
    const built = await buildExtensions({ repoRoot });
    console.error(`[build-extensions] compiled ${built.length}: ${built.map((b) => b.id).join(", ") || "—"}`);
}
