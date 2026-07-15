import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Демонстрирует горизонтальный скроллбар редактора. Файл заведомо шире вьюпорта
// (строки ~140 символов при cols: 80), поэтому полоска появляется по политике
// "auto" на выделенной нижней строке редактора.
//
// Что важно на кадре:
//  - полоска стоит на НИЖНЕЙ кромке строки (символ `▄`, нижний half-block), а не
//    висит полуклеткой выше (`▀`, как было раньше);
//  - фон строки совпадает с фоном редактора — сквозь неё не просвечивает фон
//    терминала (`setCell` передаёт bg, а не полагается на patch-семантику Grid);
//  - трек виден тусклой линией, бегунок — ярче; оба цвета из темы
//    (`scrollbar.background` / `scrollbarSlider.background`).

const wideFile = resolve(repoRoot, "e2e", "fixtures", "wide.ts");

export default defineScenario({
    name: "horizontal-scrollbar",
    title: "Editor horizontal scrollbar (bottom edge, opaque, themed)",
    open: [repoRoot, wideFile],
    cols: 80,
    rows: 16,
    async run(editor) {
        await editor.waitForText((t) => t.includes("veryLongLine"));
        await editor.capture("at-start");

        // Уезжаем вправо — бегунок сдвигается по треку.
        await editor.sendKey("ArrowDown");
        await editor.sendKey("End");
        await editor.waitForText((t) => t.includes("mu: 12"));
        await editor.capture("scrolled-right");
    },
});
