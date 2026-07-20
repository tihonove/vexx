import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PanelContainerElement } from "../../../../tuidom/ui/panel/panelContainerElement.ts";
import { createAppTestHarness, type IAppHarness } from "../../../TestUtils/AppTestHarness.ts";
import { typeText } from "../../../TestUtils/domQueries.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../../TestUtils/TempWorkspace.ts";
import { ContextKeyService, ContextKeyServiceDIToken } from "../../platform/contextkey/common/contextKeyService.ts";
import { PROBLEMS_VIEW_ID } from "../contrib/markers/browser/problemsComponent.ts";

const TOGGLE_TERMINAL = "workbench.action.terminal.toggleTerminal";
const TOGGLE_PANEL = "workbench.action.togglePanel";

/**
 * Регрессия BUG-1/BUG-2 (#175/#176): скрытая панель не должна удерживать
 * клавиатуру. До фикса фокус оставался на `TerminalViewElement`, которого уже нет
 * на сцене, и ввод уходил в невидимый шелл — с Enter команды реально выполнялись.
 */
describe("Workbench — фокус при уходе панели со сцены", () => {
    let ws: ITempWorkspace;
    let h: IAppHarness;
    let contextKeys: ContextKeyService;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-panel-focus-", files: { "alpha.txt": "Alpha" } });
        h = createAppTestHarness({ workspaceFolder: ws.dir, openFile: `${ws.dir}/alpha.txt`, focusEditor: true });
        contextKeys = h.container.get(ContextKeyServiceDIToken);
    });

    afterEach(() => {
        h.dispose();
        ws.dispose();
    });

    it("после скрытия панели ввод идёт в редактор, а не в невидимый шелл", () => {
        h.commands.execute(TOGGLE_TERMINAL); // показать панель + сфокусировать терминал
        expect(contextKeys.get("terminalFocus")).toBe(true);

        h.commands.execute(TOGGLE_TERMINAL); // скрыть панель
        expect(h.workbench.workbenchLayout.getBottomPanelVisible()).toBe(false);
        expect(contextKeys.get("terminalFocus")).toBe(false);

        typeText(h.testApp, "hi");
        expect(h.activeEditor().getText()).toBe("hiAlpha");
    });

    it("Toggle Panel при сфокусированном терминале тоже возвращает фокус редактору", () => {
        h.commands.execute(TOGGLE_TERMINAL);

        h.commands.execute(TOGGLE_PANEL); // скрыть панель другой командой

        expect(contextKeys.get("terminalFocus")).toBe(false);
        typeText(h.testApp, "x");
        expect(h.activeEditor().getText()).toBe("xAlpha");
    });

    it("уход с вкладки TERMINAL при открытой панели снимает с неё фокус", () => {
        h.commands.execute(TOGGLE_TERMINAL);

        // Клик по табу PROBLEMS: контрол переключает вкладку и сообщает сервису.
        const panel = h.workbench.workbenchLayout.getBottomPanel() as PanelContainerElement;
        panel.setActiveView(PROBLEMS_VIEW_ID);
        panel.onActivateView?.(PROBLEMS_VIEW_ID);

        expect(h.workbench.workbenchLayout.getBottomPanelVisible()).toBe(true);
        expect(contextKeys.get("terminalFocus")).toBe(false);
    });
});
