#!/usr/bin/env node
/**
 * Генератор каталога ключей настроек для builtin-расширения `vexx-settings`.
 *
 * Собирает известные ключи настроек из двух реальных источников:
 *  - app-дефолты из `src/Configuration/defaults.ts` (`getDefaultConfiguration()`),
 *    сплющенные в dotted-ключи (`editor.tabSize`, `workbench.colorTheme`, …);
 *  - `contributes.configuration.properties` всех builtin-расширений (rich: type,
 *    default, description, enum) — тот же набор, что валидирует SettingsDiagnostics.
 *
 * Пишет детерминированный (сортировка по ключу) `settings-schema.generated.ts`
 * в каталог `vexx-settings/`. Файл коммитится (его импортирует `main.ts`,
 * видимый для tsc), а `build:extensions` держит его в актуальном состоянии.
 * Извлекать app-дефолты из `.ts` в голом node помогает esbuild-transform +
 * import data-URL (у defaults.ts нет импортов — достаточно transform, не bundle).
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { build, transform } from "esbuild";

/**
 * Схемные метаданные для ключей из app-дефолтов. `Configuration/defaults.ts` — это
 * голое дерево значений (тип и default выводятся из него, а вот множество
 * допустимых значений — нет), тогда как у `contributes.configuration` схема есть
 * своя. Здесь держим только то, что нельзя вывести из самого дефолта.
 *
 * `workbench.colorTheme` не тут, а собирается из реестра тем — см. loadThemeNames.
 */
const APP_DEFAULT_OVERRIDES = {
    // Дословно из комментария в defaults.ts (`Tier override`).
    "terminal.tier": { enum: ["auto", "legacy", "csi-u", "kitty"] },
};

/** Тип значения для `detail` в completion (VS Code JSON-schema types). */
function inferType(value) {
    if (Array.isArray(value)) return "array";
    if (value === null) return "null";
    const t = typeof value;
    return t === "object" ? "object" : t; // string | number | boolean | object
}

/**
 * Сплющивает вложенное дерево дефолтов в записи по dotted-ключу. Рекурсирует в
 * непустые plain-объекты; всё остальное (примитивы, массивы, пустые объекты —
 * напр. `terminal.capabilities: {}`) трактует как leaf-настройку.
 */
function flattenDefaults(tree, prefix, out) {
    for (const [k, v] of Object.entries(tree)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0) {
            flattenDefaults(v, key, out);
        } else {
            out.push({ key, type: inferType(v), default: v });
        }
    }
}

async function loadAppDefaults(repoRoot) {
    const src = readFileSync(resolve(repoRoot, "src", "Configuration", "defaults.ts"), "utf8");
    const { code } = await transform(src, { loader: "ts", format: "esm" });
    const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
    const mod = await import(url);
    const out = [];
    flattenDefaults(mod.getDefaultConfiguration(), "", out);
    return out;
}

/**
 * Лейблы встроенных тем — допустимые значения `workbench.colorTheme`. В отличие от
 * `defaults.ts`, у `themes/builtinThemes.ts` есть импорты, поэтому нужен bundle,
 * а не transform. Каталог статичен на этапе сборки: темы, приносимые расширениями
 * (`contributes.themes`), сюда не попадут.
 */
async function loadThemeNames(repoRoot) {
    const entry = resolve(repoRoot, "src", "Theme", "themes", "builtinThemes.ts");
    const result = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: "esm",
        platform: "neutral",
        logLevel: "silent",
    });
    const code = result.outputFiles[0].text;
    const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
    const mod = await import(url);
    return mod.builtinThemes.map((theme) => theme.name);
}

function collectBuiltinContributions(repoRoot) {
    const builtinDir = resolve(repoRoot, "src", "Extensions", "builtin");
    const entries = [];
    for (const dir of readdirSync(builtinDir, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        let pkg;
        try {
            pkg = JSON.parse(readFileSync(join(builtinDir, dir.name, "package.json"), "utf8"));
        } catch {
            continue; // не расширение / битый манифест — пропускаем
        }
        const cfg = pkg?.contributes?.configuration;
        const blocks = Array.isArray(cfg) ? cfg : cfg ? [cfg] : [];
        for (const block of blocks) {
            for (const [key, schema] of Object.entries(block?.properties ?? {})) {
                entries.push({
                    key,
                    type: Array.isArray(schema?.type) ? schema.type.join(" | ") : schema?.type,
                    default: schema?.default,
                    description: schema?.markdownDescription ?? schema?.description,
                    enum: Array.isArray(schema?.enum) ? schema.enum : undefined,
                });
            }
        }
    }
    return entries;
}

/** Убирает undefined-поля, чтобы JSON.stringify не оставлял дыр и вывод был чистым. */
function prune(entry) {
    const out = {};
    for (const [k, v] of Object.entries(entry)) if (v !== undefined) out[k] = v;
    return out;
}

export async function generateSettingsSchema({ repoRoot }) {
    const byKey = new Map();
    // app-дефолты сначала; contributes перекрывают (у них richer description/enum).
    for (const e of await loadAppDefaults(repoRoot)) byKey.set(e.key, e);
    // Схема поверх app-дефолтов (enum), но под contributes — у тех она своя, полная.
    for (const [key, extra] of Object.entries(APP_DEFAULT_OVERRIDES)) {
        if (byKey.has(key)) byKey.set(key, { ...byKey.get(key), ...extra });
    }
    if (byKey.has("workbench.colorTheme")) {
        byKey.set("workbench.colorTheme", {
            ...byKey.get("workbench.colorTheme"),
            enum: await loadThemeNames(repoRoot),
        });
    }
    for (const e of collectBuiltinContributions(repoRoot)) byKey.set(e.key, { ...byKey.get(e.key), ...e });

    const entries = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key)).map(prune);

    const body = entries.map((e) => `    ${JSON.stringify(e)},`).join("\n");
    const file = `// GENERATED FILE — не редактировать вручную.
// Регенерируется \`npm run build:extensions\` (scripts/generate-settings-schema.mjs).
// Каталог известных ключей настроек: app-дефолты (Configuration/defaults.ts) +
// contributes.configuration всех builtin-расширений. Вшивается в vexx-settings
// на этапе сборки и служит источником автодополнения в settings.json.

export interface ISettingSchemaEntry {
    readonly key: string;
    readonly type?: string;
    readonly default?: unknown;
    readonly description?: string;
    readonly enum?: readonly unknown[];
}

export const SETTINGS_SCHEMA: readonly ISettingSchemaEntry[] = [
${body}
];
`;
    const outPath = resolve(repoRoot, "src", "Extensions", "builtin", "vexx-settings", "settings-schema.generated.ts");
    writeFileSync(outPath, file, "utf8");
    return { outPath, count: entries.length };
}

// Прямой запуск: `node scripts/generate-settings-schema.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
    const repoRoot = resolve(import.meta.dirname, "..");
    const { outPath, count } = await generateSettingsSchema({ repoRoot });
    console.error(`[generate-settings-schema] wrote ${count} keys → ${outPath}`);
}
