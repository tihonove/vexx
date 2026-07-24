import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineScenario } from "./framework.ts";

// Вкладка CHANGES нижней панели: список изменённых файлов от git-расширения; по
// файлу открывается дифф этапа 5. Изменения делаем НА ДИСКЕ (а не в буфере) —
// список берётся из `git status`, который видит только сохранённое.

function git(cwd: string, ...args: string[]): void {
    execFileSync("git", args, { cwd, stdio: "ignore" });
}

/** Репозиторий: закоммиченный файл + его правка на диске + untracked-файл. */
function makeRepo(): { repoDir: string; trackedFile: string } {
    const repoDir = mkdtempSync(join(tmpdir(), "vexx-changes-demo-"));
    git(repoDir, "init", "-q");
    git(repoDir, "config", "user.email", "t@example.com");
    git(repoDir, "config", "user.name", "Test");
    git(repoDir, "config", "commit.gpgsign", "false");
    // Имя сортируется раньше extra.ts, чтобы модифицированный (диффабельный) файл
    // был первой строкой списка — по нему и открываем дифф.
    const trackedFile = join(repoDir, "app.ts");
    writeFileSync(trackedFile, ["export function greet(name: string) {", '    return "hi " + name;', "}", ""].join("\n"));
    git(repoDir, "add", "-A");
    git(repoDir, "commit", "-qm", "init");
    // Правим на диске (modified) и добавляем новый файл (untracked).
    writeFileSync(trackedFile, ["export function greet(name: string) {", '    return "hello " + name;', "}", ""].join("\n"));
    writeFileSync(join(repoDir, "extra.ts"), "export const answer = 42;\n");
    return { repoDir, trackedFile };
}

const { repoDir } = makeRepo();

export default defineScenario({
    name: "changes-panel",
    title: "Вкладка Changes: список изменений и дифф по клику",
    open: [repoDir],
    cols: 100,
    rows: 22,
    // Нужен extension host — набор изменений публикует git-расширение.
    skipOn: ["win32", "darwin"],
    // Toggle Changes — через user-кейбинд (детерминированно, без палитры). Букву
    // берём НЕ мнемоническую: F/E/S/V/G/H — это меню-бар (File…Go…Help), Alt+<она>
    // раскрыл бы меню, а не выполнил команду.
    userKeybindings: [{ key: "alt+c", command: "workbench.action.scm.toggleChanges" }],
    async run(editor) {
        // Готовность: дерево показывает файлы с git-статусами (расширение поднялось
        // и посчитало git status).
        await editor.waitForText((t) => t.includes("app.ts") && t.includes("extra.ts"));

        // Открываем вкладку CHANGES нижней панели и ждём НАПОЛНЕННЫЙ список:
        // список становится контентом вкладки (узел changesView) только когда
        // расширение опубликовало набор — до этого там placeholder.
        await editor.sendKey("Alt+C");
        await editor.waitForText((t) => t.includes("CHANGES") && !t.includes("No source-control changes"));
        const list = await editor.waitForNode("#changesView");
        await editor.capture("changes");

        // Двойной клик по первой строке списка (app.ts, modified) открывает
        // вкладку-смотрелку этапа 5 — ровно тот жест, ради которого список и нужен.
        // Координаты берём из бокса самого списка (id changesView), а не из текста:
        // app.ts есть и в дереве слева. Двойной, а не одиночный: по дереву одиночный
        // клик лишь выделяет строку, активирует dblclick. Шлём 4 события подряд без
        // settle, чтобы уложиться в окно распознавания двойного клика (300 мс).
        const x = list.box.x + 2;
        const y = list.box.y;
        await editor.sendMouse({ action: "press", button: "left", x, y });
        await editor.sendMouse({ action: "release", button: "left", x, y });
        await editor.sendMouse({ action: "press", button: "left", x, y });
        await editor.sendMouse({ action: "release", button: "left", x, y });
        await editor.waitForText((t) => t.includes("↔ HEAD"));
        await editor.capture("diff");
    },
});
