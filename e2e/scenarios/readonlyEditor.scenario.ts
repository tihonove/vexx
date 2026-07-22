import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Read-only editor: `File: Toggle Active Editor Read-only in Session` (порт
// `workbench.action.files.toggleActiveEditorReadonlyInSession` из VS Code).
// Смотрим на то же, что видит пользователь: замок на вкладке и текст, который
// не меняется от набора.
//
// Команду вешаем на Alt+R через user-кейбинды (буква R не занята мнемоникой
// меню — там F/E/S/V/G/H), а не зовём из палитры: палитра
// возвращает фокус тому, у кого он был на момент открытия, а добраться до неё
// headless можно только через меню-бар (Ctrl+Shift+<буква> терминал не кодирует
// вовсе) — фокус оставался бы в меню, набор не доходил бы до редактора, и кадр
// «ввод заблокирован» выглядел бы правильным, ничего не доказывая.

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "sample.ts");

/** nf-cod-lock — метка read-only вкладки, см. tuidom/ui/editorgroup/editorTabItemElement.ts. */
const LOCK = "\uea75";

export default defineScenario({
    name: "readonly-editor",
    title: "Read-only editor: замок на вкладке и заблокированный ввод",
    open: [repoRoot, sampleFile],
    cols: 120,
    rows: 32,
    userKeybindings: [{ key: "alt+r", command: "workbench.action.files.toggleActiveEditorReadonlyInSession" }],
    async run(editor) {
        // Исходное состояние: файл открыт, редактор в фокусе и правится.
        await editor.waitForText((t) => t.includes("greeting"));
        await editor.capture("writable");

        await editor.sendKey("Alt+R");

        // Вкладка получила замок перед именем файла.
        await editor.waitForText((t) => t.includes(LOCK));
        await editor.capture("readonly-tab");

        // Набор в read-only не доходит до документа: ни вставки, ни удаления,
        // ни маркера изменённости на вкладке.
        await editor.sendText("ZZZ");
        await editor.sendKey("Backspace");
        await editor.capture("typing-blocked");

        // Снятие режима возвращает редактор в рабочее состояние. Здесь же — контроль
        // осмысленности предыдущего шага: тот же самый набор теперь ОБЯЗАН дойти до
        // документа. Без него кадр «ввод заблокирован» выглядел бы точно так же и
        // при потерянном фокусе.
        await editor.sendKey("Alt+R");
        await editor.waitForText((t) => !t.includes(LOCK));
        await editor.sendText("ZZZ");
        await editor.waitForText((t) => t.includes("ZZZ"));
        await editor.capture("writable-again");
    },
});
