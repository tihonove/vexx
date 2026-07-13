import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Демонстрирует ленивую активацию + автодополнение настроек: builtin-расширение
// `vexx-settings` активируется по `onLanguage:json` при открытии settings.json и
// подсказывает известные ключи настроек. Дотированный ключ (`editor.…`) в самом
// файле НЕ встречается (там `files.enableTrash`), поэтому появление строки
// `editor.` в попапе доказывает, что расширение активировалось и его
// completion-провайдер отработал (а не word-based fallback редактора). Метки в
// узком попапе усекаются (`editor.tabS…`), поэтому матчим по префиксу `editor.`.

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "settings.json");

export default defineScenario({
    name: "settings-completion",
    title: "Settings autocomplete (lazy onLanguage:json activation)",
    open: [repoRoot, sampleFile],
    cols: 100,
    rows: 24,
    // Extension-host сценарий: CI-safety-net гоняем только на Linux (на Windows
    // e2e субпроцесс-расширения флейкают — как `editorconfig-stock`/`sea-git`).
    // Скриншот всё равно генерируется через `npm run screenshots`.
    skipOn: ["win32"],
    async run(editor) {
        await editor.waitForText((t) => t.includes("files.enableTrash"));
        await editor.capture("editor");

        // На пустой последней строке печатаем префикс ключа — suggest-попап
        // открывается сам (auto-suggest), как в completion-сценарии.
        await editor.sendKey("ArrowDown");
        await editor.sendKey("ArrowDown");
        await editor.sendKey("ArrowDown");
        await editor.sendKey("e");
        await editor.sendKey("d");
        await editor.sendKey("i");

        // Строки `editor.` есть только у расширения → их появление доказывает,
        // что vexx-settings активировался и отдал completion.
        await editor.waitForText((t) => t.includes("editor."), { timeoutMs: 4000 });
        await editor.capture("suggest");
    },
});
