import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveUserDataPaths } from "../Common/UserDataPaths.ts";
import { loadState, StateService } from "../Configuration/StateService.ts";
import { createAppTestHarness, type IAppHarness } from "../TestUtils/AppTestHarness.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";

import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";

/**
 * End-to-end персистентность сессии: открыть файлы + поменять layout в одном
 * «запуске», сбросить на диск, поднять новый AppController на том же воркспейсе и
 * убедиться, что всё восстановилось. Общий на два запуска — реальный
 * `StateService` поверх одного каталога user-data.
 */
describe("AppController — session state persistence", () => {
    let ws: ITempWorkspace;
    let userData: ITempWorkspace;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-persist-ws-", files: { "a.ts": "A", "b.ts": "B", "c.ts": "C" } });
        userData = createTempWorkspace({ prefix: "vexx-persist-home-" });
    });

    afterEach(() => {
        ws.dispose();
        userData.dispose();
    });

    function newState(): StateService {
        return loadState(resolveUserDataPaths({ homedir: "/never", userDataDir: userData.dir }));
    }

    it("restores open files, active tab, sidebar width and panel state across a restart", () => {
        // ── Запуск 1: пользователь настроил рабочее место ───────────────────
        const state1 = newState();
        const h1: IAppHarness = createAppTestHarness({ workspaceFolder: ws.dir, stateService: state1 });
        h1.controller.openFile(ws.path("a.ts"));
        h1.controller.openFile(ws.path("b.ts"));
        h1.controller.openFile(ws.path("c.ts"));
        // Активной делаем среднюю вкладку.
        h1.container.get(EditorGroupControllerDIToken).activateTab(1);
        h1.controller.workbenchLayout.setLeftPanelWidth(45);
        h1.controller.workbenchLayout.setBottomPanelVisible(true);
        h1.controller.workbenchLayout.setBottomPanelHeight(8);
        state1.flushSync();
        h1.dispose();

        // ── Запуск 2: свежий AppController на том же воркспейсе ──────────────
        const state2 = newState();
        const h2: IAppHarness = createAppTestHarness({ workspaceFolder: ws.dir, stateService: state2 });
        h2.controller.restoreOpenEditors(); // main.ts вызывает это, когда в CLI нет файлов

        const group = h2.container.get(EditorGroupControllerDIToken);
        expect(group.getOpenFilePaths()).toEqual([ws.path("a.ts"), ws.path("b.ts"), ws.path("c.ts")]);
        expect(group.activeIndex).toBe(1);
        expect(h2.controller.workbenchLayout.getLeftPanelWidth()).toBe(45);
        expect(h2.controller.workbenchLayout.getBottomPanelVisible()).toBe(true);
        expect(h2.controller.workbenchLayout.getBottomPanelHeight()).toBe(8);
        h2.dispose();
    });

    it("keeps state independent per workspace folder", () => {
        const ws2 = createTempWorkspace({ prefix: "vexx-persist-ws2-", files: { "z.ts": "Z" } });
        try {
            const state1 = newState();
            const a = createAppTestHarness({ workspaceFolder: ws.dir, stateService: state1 });
            a.controller.openFile(ws.path("a.ts"));
            a.controller.workbenchLayout.setLeftPanelWidth(50);
            state1.flushSync();
            a.dispose();

            // Другой воркспейс не наследует ни файлы, ни ширину первого.
            const state2 = newState();
            const b = createAppTestHarness({ workspaceFolder: ws2.dir, stateService: state2 });
            b.controller.restoreOpenEditors();
            expect(b.container.get(EditorGroupControllerDIToken).getOpenFilePaths()).toEqual([]);
            expect(b.controller.workbenchLayout.getLeftPanelWidth()).toBe(30); // default
            b.dispose();
        } finally {
            ws2.dispose();
        }
    });
});
