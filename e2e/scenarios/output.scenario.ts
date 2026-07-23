import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Output-панель: вкладка OUTPUT в нижней Panel над настоящими каналами логов —
// bootstrap/configuration/extensions пишутся ещё до подъёма TUI, так что контент
// непустой с первого кадра. Содержимое — обычный read-only редактор с языком
// `log`, как в VS Code: гуттер, подсветка уровней, выделение и Ctrl+F.
//
// Команду вешаем на Alt+U через user-кейбинды: палитра возвращает фокус меню-бару,
// через который её открыли. Именно U, а не O: `Alt+O` кодируется как `ESC O` —
// префикс SS3-последовательностей (`ESC O P` = F1), и терминал разбирает его как
// начало спецклавиши, а не как Alt+буква.

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "sample.ts");

export default defineScenario({
    name: "output",
    title: "Output: лог подсистемы в нижней панели",
    open: [repoRoot, sampleFile],
    cols: 120,
    rows: 32,
    userKeybindings: [{ key: "alt+u", command: "workbench.action.output.toggleOutput" }],
    async run(editor) {
        await editor.waitForText((t) => t.includes("greeting"));

        await editor.sendKey("Alt+U");

        // Вкладка OUTPUT встала между PROBLEMS и TERMINAL, в ней — живой лог
        // bootstrap с уровнем в скобках (форма, которую подсвечивает грамматика).
        await editor.waitForText((t) => t.includes("OUTPUT"));
        await editor.waitForText((t) => t.includes("[info] vexx starting"));
        await editor.capture("panel");
    },
});
