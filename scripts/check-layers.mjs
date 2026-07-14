/**
 * Проверка правил слоёв src/vs (аналог `npm run valid-layers-check` у vscode,
 * см. build/checker/layersChecker.ts + eslint local/code-layering upstream).
 *
 * Две оси:
 *  1. Вертикальные слои (нижние не знают о верхних):
 *     base/common → base/node → tui (движок) → base/tui → platform → editor → workbench → vexx
 *  2. Окружения внутри слоя: common → только common; node → common+node;
 *     tui → common+node+tui (vexx — нативное node-приложение, его «браузер»
 *     сам работает на node, поэтому tui-окружению node доступен — в отличие
 *     от браузерной песочницы vscode).
 *
 * Известные нарушения зафиксированы в EXCEPTIONS (unwind — отдельными PR);
 * новые нарушения роняют скрипт. Запуск: node scripts/check-layers.mjs
 */
import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = process.cwd();

/** Вертикальный уровень файла внутри src/vs (меньше = ниже). */
function layerOf(rel) {
    if (rel.startsWith("src/vs/base/common/")) return { name: "base/common", level: 0 };
    if (rel.startsWith("src/vs/base/node/")) return { name: "base/node", level: 1 };
    if (rel.startsWith("src/vs/tui/")) return { name: "tui-engine", level: 2 };
    if (rel.startsWith("src/vs/base/tui/")) return { name: "base/tui", level: 3 };
    if (rel.startsWith("src/vs/platform/")) return { name: "platform", level: 4 };
    if (rel.startsWith("src/vs/editor/")) return { name: "editor", level: 5 };
    if (rel.startsWith("src/vs/workbench/")) return { name: "workbench", level: 6 };
    if (rel.startsWith("src/vs/vexx/")) return { name: "vexx", level: 7 };
    return null; // вне src/vs — не проверяем (TestUtils, demos, Inspector, StoryRunner, extensions)
}

/** Окружение файла: common / node / tui (по сегменту пути). */
function envOf(rel) {
    const segs = rel.split("/");
    if (segs.includes("common")) return "common";
    if (segs.includes("node")) return "node";
    if (segs.includes("tui")) return "tui";
    return null; // нет сегмента окружения (например, editor/common/model.ts покрыт common)
}

const ENV_ALLOWED = {
    common: new Set(["common"]),
    node: new Set(["common", "node"]),
    tui: new Set(["common", "node", "tui"]),
};

// Известные нарушения (файл → импортируемый файл), причины — в docs/ARCHITECTURE.md.
// Разбор — отдельными PR; список должен только уменьшаться.
const EXCEPTIONS = new Set([
    // base/tui-виджеты принимают WorkbenchTheme в applyTheme; развязка — минимальный
    // ITheme-интерфейс в base (у vscode base-виджеты берут явные style-объекты).
    "src/vs/base/tui/ui/dialog/aboutDialogElement.tsx -> src/vs/platform/theme/common/workbenchTheme.ts",
    "src/vs/base/tui/ui/dialog/confirmDialogElement.tsx -> src/vs/platform/theme/common/workbenchTheme.ts",
    "src/vs/base/tui/ui/dialog/confirmSaveDialogElement.tsx -> src/vs/platform/theme/common/workbenchTheme.ts",
    "src/vs/base/tui/ui/menu/menuBarElement.ts -> src/vs/platform/theme/common/workbenchTheme.ts",
    "src/vs/base/tui/ui/menu/popupMenuElement.ts -> src/vs/platform/theme/common/workbenchTheme.ts",
    // About-диалог показывает версию продукта; развязка — прокидывать строку версии.
    "src/vs/base/tui/ui/dialog/aboutDialogElement.tsx -> src/vs/platform/product/common/product.ts",
    // BodyElement знает конкретный StatusBarElement; развязка — принимать TUIElement.
    "src/vs/base/tui/bodyElement.ts -> src/vs/workbench/tui/parts/statusbar/statusBarElement.ts",
    // editor/contrib-контроллеры зависят от конкретного EditorGroupController вместо
    // ICodeEditor-подобного интерфейса (у vscode contrib-и видят только editor/browser).
    "src/vs/editor/contrib/find/tui/findController.ts -> src/vs/workbench/tui/parts/editor/editorGroupController.ts",
    "src/vs/editor/contrib/folding/tui/foldingActions.ts -> src/vs/workbench/tui/parts/editor/editorGroupController.ts",
    "src/vs/editor/contrib/suggest/tui/completionController.ts -> src/vs/workbench/tui/parts/editor/editorController.ts",
    "src/vs/editor/contrib/suggest/tui/completionController.ts -> src/vs/workbench/tui/parts/editor/editorGroupController.ts",
    "src/vs/editor/tui/coreCommands.ts -> src/vs/workbench/tui/parts/editor/editorGroupController.ts",
    // IMarker переиспользует IRange из editor/core (у vscode markers описан сырыми числами).
    "src/vs/platform/markers/common/markers.ts -> src/vs/editor/common/core/range.ts",
]);

function* walk(dir) {
    for (const e of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) yield* walk(rel);
        else if (/\.(ts|tsx)$/.test(e.name)) yield rel;
    }
}

const SPEC_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)(["'])([^"']+)\1/gm;

let violations = 0;
let known = 0;
for (const rel of walk("src/vs")) {
    const isTest = /\.(test|stories|bench)\.tsx?$|\.testUtils\.tsx?$|\/test\/|\/learning\//i.test(rel);
    const layer = layerOf(rel);
    if (!layer) continue;
    const env = envOf(rel);
    // Срезаем блочные комментарии, чтобы {@link import(...)} в JSDoc не давал ложных срабатываний.
    const text = fs.readFileSync(path.join(repoRoot, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of text.matchAll(SPEC_RE)) {
        const spec = m[2];
        if (!spec.startsWith(".")) continue;
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
        const targetLayer = layerOf(target);
        if (!targetLayer) continue;
        const key = `${rel} -> ${target}`;
        const problems = [];
        if (targetLayer.level > layer.level) {
            problems.push(`слой ${layer.name} не может импортировать ${targetLayer.name}`);
        }
        const targetEnv = envOf(target);
        if (env && targetEnv && !ENV_ALLOWED[env].has(targetEnv)) {
            problems.push(`окружение ${env} не может импортировать ${targetEnv}`);
        }
        if (problems.length === 0) continue;
        // Тестам и stories можно тянуть что угодно (колокация + харнессы).
        if (isTest) continue;
        if (EXCEPTIONS.has(key)) {
            known++;
            continue;
        }
        violations++;
        console.error(`LAYER VIOLATION: ${key}\n  ${problems.join("; ")}`);
    }
}

console.log(`\nchecked src/vs: ${violations} new violation(s), ${known} known exception(s)`);
process.exit(violations > 0 ? 1 : 0);
