import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { getBinaryPath } from "./helpers/buildOnce.ts";
import type { ProbeSession } from "./probeHarness.ts";
import { findAll, focusedLeaf, frameLine, frameText, removeTempDir, sleep, startProbe } from "./probeHarness.ts";

// Регрессионные пробы вокруг фикса шести дефектов (`255d596`). Фиксы трогают
// общую машинерию — Tab-обход всего дерева, пересборку любого редактора при
// перечитке, пиннинг цели find-сессии, — поэтому смотрим не только на «баг ушёл»,
// но и на соседей, которые могли поехать.

describe("PR #197 fix — регрессии соседних механизмов", () => {
    let probe: ProbeSession | null = null;
    const temps: string[] = [];

    beforeAll(async () => {
        await getBinaryPath();
    }, 300_000);

    afterEach(async () => {
        if (probe !== null) {
            await probe.dispose();
            probe = null;
        }
        // Тот же ретрай, что и у user-data-dir: каталог смотрит watcher редактора,
        // и на Windows он освобождается не мгновенно.
        while (temps.length > 0) removeTempDir(temps.pop()!);
    });

    const findRow = async (): Promise<string> => {
        const f = await probe!.session.captureFrame();
        for (let y = 0; y < f.rows; y++) if (frameLine(f, y).includes("[ ↑ ]")) return frameLine(f, y).trim();
        return "<no find widget>";
    };

    it("find после пиннинга всё ещё следует за вкладкой: закрыть → сменить вкладку → Ctrl+F ищет по новой", async () => {
        probe = await startProbe({ cols: 120, rows: 32 });
        const { session } = probe;
        await session.waitForText((t) => t.includes("greeting"));

        // Сессия 1 — по sample.ts.
        await session.sendKey("Ctrl+F");
        await sleep(400);
        await session.sendText("greeting");
        await sleep(500);
        expect(await findRow(), "поиск по sample.ts").toContain("of");
        await session.sendKey("Escape");
        await sleep(400);

        // Открываем второй файл и ищем то, чего в первом нет.
        await session.sendKey("Ctrl+P");
        await sleep(600);
        await session.sendText("wireTypes.decorations");
        await sleep(900);
        await session.sendKey("Enter");
        await sleep(1200);
        expect(frameLine(await session.captureFrame(), 1)).toContain("wireTypes");

        await session.sendKey("Ctrl+F");
        await sleep(400);
        await session.sendText("decoration");
        await sleep(700);
        // Если бы цель залипла на первой вкладке — было бы "No results".
        expect(await findRow()).not.toContain("No results");
    }, 180_000);

    // `it.fails` — тест документирует ИЗВЕСТНЫЙ дефект и потому «проходит», пока
    // дефект жив; когда его починят, он покраснеет и попросит снять маркер.
    //
    // Дефект пре-существующий, не из PR #197: проба даёт побайтово одинаковый
    // результат на `main` (c3fa124), на pre-fix head PR (cda7424) и на фикс-коммите
    // (255d596). Открытый find + открытие второй вкладки роняют фокус в никуда, а
    // дальнейший ввод молча правит первую, уже невидимую вкладку.
    // Описание и репро — docs/TODO/E2E.md, раздел «Найденные дефекты».
    it.fails("find, оставленный открытым, переживает смену вкладки", async () => {
        probe = await startProbe({ cols: 120, rows: 32 });
        const { session } = probe;
        await session.waitForText((t) => t.includes("greeting"));
        await session.sendKey("Ctrl+F");
        await sleep(400);
        await session.sendText("greeting");
        await sleep(500);

        await session.sendKey("Ctrl+P");
        await sleep(600);
        await session.sendText("wireTypes.decorations");
        await sleep(900);
        await session.sendKey("Enter");
        await sleep(1200);
        await session.sendKey("Escape");
        await sleep(500);

        // Приложение живо и отвечает инспектору, ввод доходит до редактора.
        expect((await session.getDocument()).root).not.toBeNull();
        await session.sendText("REG");
        await sleep(500);
        expect(frameText(await session.captureFrame())).toContain("REG");
    }, 180_000);

    it("Tab внутри открытого find-виджета остаётся внутри виджета", async () => {
        probe = await startProbe({ cols: 120, rows: 32 });
        const { session } = probe;
        await session.waitForText((t) => t.includes("greeting"));
        await session.sendKey("Ctrl+F");
        await sleep(500);
        const before = focusedLeaf((await session.getDocument()).root);
        expect(before?.type).toBe("InputElement");
        await session.sendKey("Tab");
        await sleep(400);
        const after = focusedLeaf((await session.getDocument()).root);
        expect(after, "после Tab фокус обязан на чём-то стоять").not.toBeNull();
        await session.sendKey("Escape");
        await sleep(400);
        expect(focusedLeaf((await session.getDocument()).root)?.type).toBe("EditorElement");
    }, 180_000);

    it("Tab в writable-редакторе по-прежнему вставляет отступ", async () => {
        probe = await startProbe({ cols: 120, rows: 32 });
        const { session } = probe;
        await session.waitForText((t) => t.includes("greeting"));
        await session.click(50, 3);
        await sleep(300);
        await session.sendKey("Tab");
        await sleep(400);
        expect(frameLine(await session.captureFrame(), 3)).toContain("const greeting     = ");
        expect(focusedLeaf((await session.getDocument()).root)?.type).toBe("EditorElement");
    }, 180_000);

    it("read-only на обычной вкладке всё ещё переключается", async () => {
        probe = await startProbe({ cols: 120, rows: 32 });
        const { session } = probe;
        await session.waitForText((t) => t.includes("greeting"));
        await session.click(50, 3);
        await sleep(300);
        await session.sendKey("Alt+R");
        await sleep(500);
        expect(frameLine(await session.captureFrame(), 1)).toContain("\uea75"); // nf-cod-lock
        await session.sendText("NOPE");
        await sleep(400);
        expect(frameText(await session.captureFrame())).not.toContain("NOPE");
        await session.sendKey("Alt+R");
        await sleep(500);
        expect(frameLine(await session.captureFrame(), 1)).not.toContain("\uea75");
        await session.sendText("YES");
        await sleep(400);
        expect(frameText(await session.captureFrame())).toContain("YES");
    }, 180_000);

    it("живой хвост Output по-прежнему следует за логом, когда курсор в конце", async () => {
        probe = await startProbe({ cols: 120, rows: 32 });
        const { session } = probe;
        await session.waitForText((t) => t.includes("greeting"));
        await session.sendKey("Alt+U");
        await session.waitForText((t) => t.includes("OUTPUT"));

        // Канал Keybindings — пишет строку на каждое нажатие.
        const sel = findAll((await session.getDocument()).root, (n) => n.type === "SelectBoxElement")[0];
        await session.click(sel.box.x + 2, sel.box.y);
        await sleep(300);
        const popup = findAll((await session.getDocument()).root, (n) => n.type === "PopupMenuElement")[0];
        await session.click(popup.box.x + 4, popup.box.y + 10); // Keybindings — последний
        await sleep(600);
        expect(frameText(await session.captureFrame())).toContain("Keybindings");

        // Набиваем лог сильно больше высоты панели и смотрим, что видно последнее.
        for (let i = 0; i < 20; i++) await session.sendKey("ArrowRight");
        await sleep(800);
        const f = await session.captureFrame();
        const lines: number[] = [];
        for (let y = 21; y <= 29; y++) {
            const m = /^\s*(\d+)\s+\d\d:\d\d:\d\d/u.exec(frameLine(f, y).slice(32));
            if (m !== null) lines.push(Number(m[1]));
        }
        expect(lines.length, "в панели должны быть видны строки лога").toBeGreaterThan(0);
        // Хвост: последняя видимая строка — одна из самых свежих.
        expect(Math.max(...lines)).toBeGreaterThan(15);
    }, 180_000);

    it("перечитка файла с диска не крадёт фокус, если пользователь не в редакторе", async () => {
        const dir = mkdtempSync(join(tmpdir(), "vexx-reload-"));
        temps.push(dir);
        const file = join(dir, "watched.txt");
        writeFileSync(file, "original line\n");

        probe = await startProbe({ cols: 120, rows: 32, args: [dir, file] });
        const { session } = probe;
        await session.waitForText((t) => t.includes("original line"));

        // Уводим фокус из редактора — в дерево файлов.
        await session.click(6, 3);
        await sleep(600);
        const before = focusedLeaf((await session.getDocument()).root);
        expect(before?.type, "фокус должен уйти из редактора").not.toBe("EditorElement");

        writeFileSync(file, "changed on disk\n");
        await session.waitForText((t) => t.includes("changed on disk"), { timeoutMs: 15_000 });
        await sleep(600);

        const after = focusedLeaf((await session.getDocument()).root);
        expect(after?.type, "перечитка не должна утаскивать фокус в редактор").toBe(before?.type);
    }, 180_000);
});
