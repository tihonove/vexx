import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Модальные диалоги после переезда в Workbench-компоненты: рисуются из
// контролов TUIDom, а цвета берут только из активной темы (editorWidget.*,
// descriptionForeground, button.*) вместо прежних хардкодов.

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "sample.ts");

export default defineScenario({
    name: "dialogs",
    title: "Модальные диалоги (Workbench-компоненты): confirm-save и About",
    open: [repoRoot, sampleFile],
    cols: 120,
    rows: 32,
    async run(editor) {
        await editor.waitForText((t) => t.includes("greeting"));

        // Меняем буфер и закрываем вкладку → диалог «сохранить изменения?».
        await editor.sendText("x");
        await editor.sendKey("Ctrl+W");
        await editor.waitForText((t) => t.includes("Do you want to save"));
        await editor.capture("confirm-save");

        // Cancel → About из меню Help.
        await editor.sendKey("Escape");
        await editor.sendKey("Alt+H");
        await editor.waitForText((t) => t.includes("About"));
        await editor.sendKey("Enter");
        await editor.waitForText((t) => t.includes("Version"));
        await editor.capture("about");
    },
});
