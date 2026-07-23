import { afterEach, beforeAll, describe, expect, it } from "vitest";

import type { HeadlessApp } from "./helpers/appSession.ts";
import { getBinaryPath } from "./helpers/buildOnce.ts";
import { openOutput, startOutputApp, waitForPanelPersisted } from "./outputPanel.shared.ts";

// Регрессия #204: после restore сессии с открытой панелью Output клик по селектору
// канала не раскрывал список — «выпадашки не видно». Панель восстанавливается
// активной без клика, и на этом пути кэш `root` у селектора оставался null, так
// что `SelectBoxElement.open()` не находил overlay-слой и молча выходил.
// Механику фикса (overlay ищется по живой цепочке родителей) проверяет юнит
// `selectBoxElement.test.ts`; здесь — настоящий флоу: открыть Output, дать
// состоянию persist'нуться, перезапуститься на том же корне и кликнуть селектор.

describe("Output: селектор канала кликабелен после restore (#204)", () => {
    let app: HeadlessApp | null = null;

    beforeAll(async () => {
        await getBinaryPath();
    }, 300_000);

    afterEach(async () => {
        await app?.dispose();
        app = null;
    });

    it("клик по селектору раскрывает список каналов на восстановленной панели", async () => {
        // Прогон 1: открыть Output, дождаться записи видимости панели на диск.
        const first = await startOutputApp({ keepRoot: true });
        const root = first.env.root;
        try {
            await openOutput(first.session);
            await waitForPanelPersisted(root);
        } finally {
            await first.session.dispose(); // корень НЕ удаляем (keepRoot)
        }

        // Прогон 2: панель восстановлена активной, без клика.
        app = await startOutputApp({ root, keepRoot: false });
        await app.session.waitForText((t) => t.includes("greeting"), { timeoutMs: 30_000 });
        const sel = await app.session.waitForNode("SelectBoxElement", { timeoutMs: 30_000 });
        expect(sel.state?.options, "селектор наполнен каналами после restore").toBeDefined();

        // До фикса: клик молча ничего не открывал (root у селектора == null).
        await app.session.clickNode("SelectBoxElement");
        const popup = await app.session.waitForNode("PopupMenuElement");
        expect(popup, "клик по селектору раскрывает список каналов после restore").toBeDefined();
    }, 180_000);
});
