import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Демонстрирует ленивую активацию + автодополнение настроек: builtin-расширение
// `vexx-settings` активируется по `onLanguage:json` при открытии settings.json и
// подсказывает известные ключи настроек. Ключ `editor.tabSize` в самом файле НЕ
// встречается — если он появился в попапе, значит расширение реально активировалось
// и его completion-провайдер отработал (а не word-based fallback редактора).

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "settings.json");

/** Number of times `needle` occurs in `haystack`. */
function count(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

export default defineScenario({
    name: "settings-completion",
    title: "Settings autocomplete (lazy onLanguage:json activation)",
    open: [repoRoot, sampleFile],
    cols: 100,
    rows: 24,
    async run(editor) {
        await editor.waitForText((t) => t.includes("files.enableTrash"));
        await editor.capture("editor");

        // На пустой последней строке печатаем префикс ключа и явно дёргаем suggest.
        await editor.sendKey("ArrowDown");
        await editor.sendKey("ArrowDown");
        await editor.sendKey("ArrowDown");
        await editor.sendKey("e");
        await editor.sendKey("d");
        await editor.sendKey("i");
        await editor.sendKey("Ctrl+Space");

        // `editor.tabSize` есть только у расширения → его появление доказывает,
        // что vexx-settings активировался и отдал completion.
        await editor.waitForText((t) => count(t, "editor.tabSize") >= 1, { timeoutMs: 4000 });
        await editor.capture("suggest");
    },
});
