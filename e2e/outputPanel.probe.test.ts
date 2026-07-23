import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { getBinaryPath } from "./helpers/buildOnce.ts";
import type { ProbeSession } from "./probeHarness.ts";
import { findAll, focusedLeaf, frameLine, frameText, panelTabPoint, sleep, startProbe } from "./probeHarness.ts";

// Пробы тестировщика по PR #197 («панель Output с выбором подсистемы»).
// Всё — чёрным ящиком через инспектор настоящего SEA-бинаря: клавиши, мышь,
// снимок дерева и кадр. Каждый `it` — один дефект или одна заявленная гарантия.
//
// Помечено `[BUG-n]` — падает на head PR (cda7424) и является отчётом о дефекте.

const OUTPUT_TAB = "OUTPUT";

describe("PR #197 — Output panel (probe)", () => {
    let probe: ProbeSession | null = null;

    beforeAll(async () => {
        await getBinaryPath();
    }, 300_000);

    afterEach(async () => {
        if (probe !== null) {
            await probe.dispose();
            probe = null;
        }
    });

    /** Открывает панель Output и возвращает узел селектора канала. */
    async function openOutput(): Promise<{ x: number; y: number; width: number; height: number }> {
        probe = await startProbe({ cols: 120, rows: 32 });
        await probe.session.waitForText((t) => t.includes("greeting"));
        await probe.session.sendKey("Alt+U");
        await probe.session.waitForText((t) => t.includes(OUTPUT_TAB));
        const root = await probe.session.waitForDocument(
            (r) => findAll(r, (n) => n.type === "SelectBoxElement").length > 0,
        );
        return findAll(root, (n) => n.type === "SelectBoxElement")[0].box;
    }

    /** Раскрывает список каналов мышью и кликает по пункту с индексом `index`. */
    async function pickChannel(selBox: { x: number; y: number }, index: number): Promise<void> {
        const session = probe!.session;
        await session.click(selBox.x + 2, selBox.y);
        await sleep(300);
        const popup = findAll((await session.getDocument()).root, (n) => n.type === "PopupMenuElement")[0];
        expect(popup, "клик по селектору должен раскрывать список каналов").toBeDefined();
        await session.click(popup.box.x + 4, popup.box.y + 1 + index);
        await sleep(500);
    }

    // ── Заявленное поведение: работает ──────────────────────────────────────

    it("открывает вкладку OUTPUT между PROBLEMS и TERMINAL с непустым логом", async () => {
        await openOutput();
        const text = frameText(await probe!.session.captureFrame());
        const header = text.split("\n").find((l) => l.includes("PROBLEMS"))!;
        expect(header.indexOf("PROBLEMS")).toBeLessThan(header.indexOf("OUTPUT"));
        expect(header.indexOf("OUTPUT")).toBeLessThan(header.indexOf("TERMINAL"));
        expect(text).toMatch(/\d\d:\d\d:\d\d\.\d\d\d \[info\] vexx starting/u);
    }, 120_000);

    it("переключает канал мышью через селектор — меняется и контент, и подпись", async () => {
        const sel = await openOutput();
        await pickChannel(sel, 2); // Extensions
        const text = frameText(await probe!.session.captureFrame());
        expect(text).toContain("Extensions");
        expect(text).not.toContain("vexx starting");
    }, 120_000);

    it("клик по селектору не переключает вкладку панели, клики по табам работают", async () => {
        const sel = await openOutput();
        const session = probe!.session;
        await session.click(sel.x + 2, sel.y);
        await sleep(300);
        expect(frameText(await session.captureFrame())).toContain("OUTPUT");
        await session.sendKey("Escape");
        // Ждём предикатом, а не паузой: на медленном раннере список мог ещё жить,
        // а координаты вкладок мы берём из дерева и они должны быть уже валидны.
        const closed = await session.waitForDocument(
            (r) => findAll(r, (n) => n.type === "PopupMenuElement").length === 0,
        );

        // Уходим на PROBLEMS, а НЕ на TERMINAL: активация терминала спавнит
        // настоящий PTY, а node-pty у нас пока Unix-only (по этой же причине
        // `terminal.scenario.ts` объявляет `skipOn: ["win32", "darwin"]`). На
        // Windows-раннере клик по TERMINAL валил спавн, и ошибка прилетала наружу
        // через RPC инспектора — тест краснел не по делу.
        const problemsTab = panelTabPoint(closed, "PROBLEMS");
        await session.click(problemsTab.x, problemsTab.y);
        // Вне OUTPUT селектор канала должен исчезнуть.
        await session.waitForDocument((r) => findAll(r, (n) => n.type === "SelectBoxElement").length === 0);

        const outputTab = panelTabPoint(closed, "OUTPUT");
        await session.click(outputTab.x, outputTab.y);
        await session.waitForDocument((r) => findAll(r, (n) => n.type === "SelectBoxElement").length === 1);
    }, 120_000);

    // ── Дефекты ─────────────────────────────────────────────────────────────

    it("[BUG-1] после смены канала фокус не теряется", async () => {
        const sel = await openOutput();
        const session = probe!.session;
        expect(focusedLeaf((await session.getDocument()).root)?.type).toBe("EditorElement");

        await pickChannel(sel, 2);

        // Фактически: focusedLeaf === null — фокуса нет ни в одном элементе,
        // клавиатура «проваливается», Ctrl+F уходит в файл за панелью.
        expect(focusedLeaf((await session.getDocument()).root)?.type).toBe("EditorElement");
    }, 120_000);

    it("[BUG-1b] смена канала командой (палитра/кейбинд) тоже не должна ронять фокус", async () => {
        await openOutput();
        const session = probe!.session;
        await session.sendKey("Alt+J"); // workbench.action.output.show.extensions
        await sleep(600);
        expect(focusedLeaf((await session.getDocument()).root)?.type).toBe("EditorElement");
    }, 120_000);

    it("[BUG-2] Toggle Read-only при фокусе в Output не должен делать лог редактируемым", async () => {
        const sel = await openOutput();
        const session = probe!.session;
        await session.click(sel.x - 40, sel.y + 2); // курсор в тело лога
        await sleep(300);
        await session.sendKey("Alt+R"); // toggleActiveEditorReadonlyInSession
        await sleep(400);
        await session.sendText("HACKED");
        await sleep(500);
        expect(frameText(await session.captureFrame())).not.toContain("HACKED");
    }, 120_000);

    it("[BUG-3] живой канал не должен рвать выделение в Output", async () => {
        const sel = await openOutput();
        const session = probe!.session;

        const selectedCells = async (): Promise<number> => {
            const f = await session.captureFrame();
            const counts = new Map<number, number>();
            const cells: number[] = [];
            for (let y = 21; y <= 29; y++) {
                for (let x = 32; x < f.cols; x++) {
                    const bg = f.cells[y * f.cols + x].bg;
                    cells.push(bg);
                    counts.set(bg, (counts.get(bg) ?? 0) + 1);
                }
            }
            let dominant = 0;
            let best = -1;
            for (const [bg, n] of counts) if (n > best) [dominant, best] = [bg, n];
            return cells.filter((bg) => bg !== dominant).length;
        };

        // Контроль: статичный канал Bootstrap — выделение видно.
        await pickChannel(sel, 0);
        await session.click(40, 21);
        await sleep(250);
        for (let i = 0; i < 8; i++) await session.sendKey("Shift+ArrowRight");
        await sleep(300);
        expect(await selectedCells(), "в статичном канале выделение обязано быть").toBeGreaterThan(0);

        // Опыт: живой канал Keybindings (пишет на каждый keydown).
        await pickChannel(sel, 9);
        await session.click(40, 21);
        await sleep(250);
        for (let i = 0; i < 8; i++) await session.sendKey("Shift+ArrowRight");
        await sleep(300);
        // Фактически 0: revealLastLine → goToPosition схлопывает выделение на каждой записи.
        expect(await selectedCells(), "в живом канале выделение тоже должно жить").toBeGreaterThan(0);
    }, 180_000);

    it("[BUG-4] Ctrl+F при фокусе в Output ищет по логу, а не по файлу за панелью", async () => {
        const sel = await openOutput();
        const session = probe!.session;
        await session.click(sel.x - 40, sel.y + 2);
        await sleep(300);
        await session.sendKey("Ctrl+F");
        await sleep(500);
        // "starting" есть в логе (`[info] vexx starting`) и отсутствует в sample.ts.
        await session.sendText("starting");
        await sleep(600);
        const f = await session.captureFrame();
        let findLine = "";
        for (let y = 0; y < f.rows; y++) if (frameLine(f, y).includes("[ ↑ ]")) findLine = frameLine(f, y);
        expect(findLine, "find-виджет должен был открыться").not.toBe("");
        // Фактически: "No results" — искали по sample.ts.
        expect(findLine).not.toContain("No results");
    }, 120_000);

    it("[BUG-5] Tab в read-only редакторе не должен уводить фокус в невидимый виджет", async () => {
        const sel = await openOutput();
        const session = probe!.session;
        await session.click(sel.x - 40, sel.y + 2);
        await sleep(300);
        await session.sendKey("Tab");
        await sleep(400);
        const leaf = focusedLeaf((await session.getDocument()).root);
        // Фактически: QuickPickElement из OverlayLayer — невидимый виджет ловит ввод.
        expect(leaf?.type).not.toBe("QuickPickElement");
    }, 120_000);

    it("[BUG-6] после рестарта с открытой вкладкой OUTPUT лог виден сразу", async () => {
        const first = await startProbe({ cols: 120, rows: 32, keepUserData: true });
        const dir = first.userDataDir;
        try {
            await first.session.waitForText((t) => t.includes("greeting"));
            await first.session.sendKey("Alt+U");
            await first.session.waitForText((t) => t.includes("[info] vexx starting"));
            await sleep(1500); // дебаунс StateService
        } finally {
            await first.dispose();
        }

        probe = await startProbe({ cols: 120, rows: 32, userDataDir: dir });
        await probe.session.waitForText((t) => t.includes("greeting"), { timeoutMs: 30_000 });
        await sleep(2000);
        const text = frameText(await probe.session.captureFrame());
        expect(text, "панель должна восстановиться на вкладке OUTPUT").toContain("OUTPUT");
        // Фактически: "No output yet." — контент не создан до первой активации вкладки.
        expect(text).not.toContain("No output yet.");
        expect(text).toMatch(/\[info\] vexx starting/u);
    }, 180_000);
});
