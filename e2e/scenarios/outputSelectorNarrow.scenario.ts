import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Регрессия #204: на тесной панели селектор канала в шапке Output ужимался за
// конец таб-строки и получал нулевую ширину — оказывался за правым краем,
// невидим и некликабелен, «выпадашки с выбором не видно». Теперь он ужимается до
// шеврона `⌄` у правого края панели, оставаясь видимой и кликабельной мишенью
// (сам список каналов раскрывается на полную ширину независимо от закрытого
// контрола — см. `selectBoxElement.test.ts` и `outputPanel.probe.test.ts`).
//
// Узкий терминал (66 колонок при дефолтном сайдбаре в 30) — ровно тот случай,
// где раньше контрол пропадал; сюда попадают сплиты tmux и узкие ssh-сессии.

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "sample.ts");

export default defineScenario({
    name: "output-selector-narrow",
    title: "Output: селектор канала виден даже на тесной панели (#204)",
    open: [repoRoot, sampleFile],
    cols: 66,
    rows: 22,
    userKeybindings: [{ key: "alt+u", command: "workbench.action.output.toggleOutput" }],
    async run(editor) {
        await editor.waitForText((t) => t.includes("greeting"));

        await editor.sendKey("Alt+U");
        await editor.waitForText((t) => t.includes("OUTPUT"));
        // Лог активного канала на месте — панель и селектор в шапке отрисованы.
        // Шеврон `⌄` селектора виден у правого края шапки, хотя места впритык: он
        // ужат до одной колонки, но остаётся видимой и кликабельной мишенью (его
        // присутствие проверяет `panelContainerElement.actions.test.ts`).
        await editor.waitForText((t) => t.includes("[info]"));
        await editor.capture("narrow-selector");
    },
});
