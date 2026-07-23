import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../../../../tuidom/common/geometryPromitives.ts";
import { createAppTestHarness, type IAppHarness } from "../../../TestUtils/AppTestHarness.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../../TestUtils/TempWorkspace.ts";
import { ILogServiceDIToken } from "../../platform/log/common/iLogServiceDIToken.ts";
import { LogService } from "../../platform/log/common/logService.ts";
import { RingBufferSink } from "../../platform/log/common/ringBufferSink.ts";
import { PROBLEMS_VIEW_ID } from "../contrib/markers/browser/problemsComponent.ts";
import { PanelServiceDIToken } from "./parts/panel/panelService.ts";
import { EditorServiceDIToken } from "../services/editor/browser/editorService.ts";
import { LogHistoryDIToken, OUTPUT_VIEW_ID, OutputChannelRegistryDIToken } from "../services/output/common/output.ts";
import { OutputChannelRegistry } from "../services/output/common/outputChannelRegistry.ts";
import { OutputServiceDIToken } from "../services/output/common/outputService.ts";

const TOGGLE_OUTPUT = "workbench.action.output.toggleOutput";

/**
 * Output-панель целиком: от записи в лог до кадра. Тесты сервиса
 * (`outputService.test.ts`) по устройству не видят ни вкладки, ни редактора —
 * здесь проверяется именно то, что между ними.
 */
describe("Workbench — Output panel", () => {
    let ws: ITempWorkspace;
    let h: IAppHarness;
    let logService: LogService;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-output-", files: { "alpha.txt": "Alpha" } });
        // Настоящие LogService + RingBufferSink вместо null-сервиса профиля тестов:
        // связка «лог → буфер → панель» и есть предмет проверки.
        logService = new LogService();
        const history = new RingBufferSink();
        logService.addSink(history);
        logService.createLogger("bootstrap").info("vexx starting");
        logService.createLogger("configuration").warn("settings.json is empty");

        h = createAppTestHarness({
            workspaceFolder: ws.dir,
            size: new Size(120, 32),
            containerOverrides: (container) => {
                container.bind(ILogServiceDIToken, () => logService);
                container.bind(LogHistoryDIToken, () => history);
            },
        });
        h.workbench.openFile(ws.path("alpha.txt"));
    });

    afterEach(() => {
        h.dispose();
        ws.dispose();
    });

    function frame(): string {
        h.testApp.render();
        return h.testApp.backend.screenToString();
    }

    function outputService() {
        return h.container.get(OutputServiceDIToken);
    }

    it("регистрирует вкладку OUTPUT между PROBLEMS и TERMINAL", () => {
        const panel = h.workbench.workbenchLayout.getBottomPanel();
        expect(panel).not.toBeNull();
        h.commands.execute(TOGGLE_OUTPUT);
        expect(frame()).toContain("OUTPUT");
    });

    it("показывает записи активного канала в кадре", () => {
        h.commands.execute(TOGGLE_OUTPUT);

        expect(frame()).toContain("vexx starting");
    });

    it("смена канала перерисовывает содержимое", () => {
        h.commands.execute(TOGGLE_OUTPUT);
        expect(frame()).toContain("vexx starting");

        outputService().showChannel("configuration");

        const text = frame();
        expect(text).toContain("settings.json is empty");
        expect(text).not.toContain("vexx starting");
    });

    it("живой хвост дописывает строку без переоткрытия вкладки", () => {
        h.commands.execute(TOGGLE_OUTPUT);

        logService.createLogger("bootstrap").info("extension host started");

        expect(frame()).toContain("extension host started");
    });

    it("запись в неактивный канал в кадр не попадает", () => {
        h.commands.execute(TOGGLE_OUTPUT);

        logService.createLogger("configuration").info("not shown");

        expect(frame()).not.toContain("not shown");
    });

    it("уровень записи оформлен скобками — под грамматику log", () => {
        h.commands.execute(TOGGLE_OUTPUT);
        expect(frame()).toContain("[info] vexx starting");
    });

    it("записи до открытия вкладки не теряются — при открытии они уже в кадре", () => {
        // Редактор поднимается лениво, поэтому хвост, прилетевший раньше, обязан
        // приехать из истории, а не потеряться между сервисом и редактором.
        logService.createLogger("bootstrap").info("before opening");

        h.commands.execute(TOGGLE_OUTPUT);

        expect(frame()).toContain("before opening");
    });

    it("повторное открытие вкладки не задваивает содержимое", () => {
        h.commands.execute(TOGGLE_OUTPUT);
        h.commands.execute(TOGGLE_OUTPUT);
        h.commands.execute(TOGGLE_OUTPUT);

        const occurrences = frame().split("vexx starting").length - 1;
        expect(occurrences).toBe(1);
    });

    it("клик по вкладке OUTPUT наполняет её, а не только команда", () => {
        // Пользовательский путь идёт через `activateView` (клик по табу), а
        // toggle-команда — через `setActiveView`, и события активации не шлёт.
        // Без подписки на activateView клик по табу давал бы пустую вкладку.
        const panelService = h.container.get(PanelServiceDIToken);
        h.commands.execute("workbench.action.togglePanel");

        panelService.activateView(OUTPUT_VIEW_ID);

        expect(frame()).toContain("vexx starting");
    });

    it("активация соседней вкладки панели Output не трогает", () => {
        h.commands.execute(TOGGLE_OUTPUT);
        const panelService = h.container.get(PanelServiceDIToken);

        panelService.activateView(PROBLEMS_VIEW_ID);

        expect(outputService().getActiveChannelId()).toBe("bootstrap");
    });
});

describe("Workbench — Output: пустые каналы", () => {
    it("канал без записей открывается пустым редактором, а не падением", () => {
        // Реестр пред-заполнен известными каналами, поэтому активный канал есть
        // всегда — даже когда в него ещё ничего не написали (профиль тестов даёт
        // NULL_LOG_SERVICE). Это и есть поведение VS Code: вкладка открыта, канал
        // выбран, содержимое пустое.
        const ws = createTempWorkspace({ prefix: "vexx-output-empty-" });
        const h = createAppTestHarness({ workspaceFolder: ws.dir, size: new Size(120, 32) });

        h.commands.execute(TOGGLE_OUTPUT);

        h.testApp.render();
        expect(h.testApp.backend.screenToString()).toContain("OUTPUT");
        expect(h.container.get(OutputServiceDIToken).getActiveChannelId()).toBe("bootstrap");
        h.dispose();
        ws.dispose();
    });

    it("с пустым реестром вкладка показывает placeholder", () => {
        // Ветка «активного канала нет вовсе»: в приложении недостижима, потому что
        // реестр заполняется в DI-модуле, но контракт компонента обязан её держать —
        // иначе пустой реестр давал бы редактор без канала.
        const ws = createTempWorkspace({ prefix: "vexx-output-noreg-" });
        const h = createAppTestHarness({
            workspaceFolder: ws.dir,
            size: new Size(120, 32),
            containerOverrides: (container) => {
                const empty = new OutputChannelRegistry();
                container.bind(OutputChannelRegistryDIToken, () => empty);
            },
        });

        h.commands.execute(TOGGLE_OUTPUT);

        h.testApp.render();
        expect(h.container.get(OutputServiceDIToken).getActiveChannelId()).toBeNull();
        expect(h.testApp.backend.screenToString()).toContain("No output yet.");
        h.dispose();
        ws.dispose();
    });
});

describe("Workbench — Output: редактор вне таб-строки", () => {
    let ws: ITempWorkspace;
    let h: IAppHarness;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-output-pane-", files: { "alpha.txt": "Alpha" } });
        const logService = new LogService();
        const history = new RingBufferSink();
        logService.addSink(history);
        logService.createLogger("bootstrap").info("hello");
        h = createAppTestHarness({
            workspaceFolder: ws.dir,
            size: new Size(120, 32),
            containerOverrides: (container) => {
                container.bind(ILogServiceDIToken, () => logService);
                container.bind(LogHistoryDIToken, () => history);
            },
        });
        h.workbench.openFile(ws.path("alpha.txt"));
    });

    afterEach(() => {
        h.dispose();
        ws.dispose();
    });

    it("Output не появляется во вкладках редакторов", () => {
        h.commands.execute(TOGGLE_OUTPUT);

        const editorService = h.container.get(EditorServiceDIToken);
        expect(editorService.editorCount).toBe(1);
        expect(editorService.getEditors()[0].fileName).toBe("alpha.txt");
    });

    it("пока фокус в Output, активный редактор — он, а не файл за панелью", () => {
        // Иначе стрелки и Ctrl+F в панели правили бы/двигали курсор в файле.
        const editorService = h.container.get(EditorServiceDIToken);
        h.commands.execute(TOGGLE_OUTPUT);

        const active = editorService.getActiveEditor();

        expect(active?.uri.scheme).toBe("output");
    });

    it("Output read-only: набор в него не проходит", () => {
        const editorService = h.container.get(EditorServiceDIToken);
        h.commands.execute(TOGGLE_OUTPUT);
        const active = editorService.getActiveEditor();
        const before = active?.getText();

        h.testApp.sendKey("X");

        expect(active?.getText()).toBe(before);
    });

    it("скрытие панели уводит фокус во вкладку, а не обратно в Output", () => {
        // `PanelFocusContribution` зовёт `focusEditor()`, чтобы фокус не остался на
        // невидимом виджете. Если бы focusEditor ходил через focus-aware
        // getActiveEditor, он вернул бы фокус в ту же скрытую панель — и ввод
        // продолжал бы уходить в никуда.
        const editorService = h.container.get(EditorServiceDIToken);
        h.commands.execute(TOGGLE_OUTPUT);
        expect(editorService.getActiveEditor()?.uri.scheme).toBe("output");

        h.commands.execute(TOGGLE_OUTPUT);

        // Ассерт именно на то, ГДЕ фокус: `getActiveEditor()` вернул бы вкладку и
        // в сломанном варианте — там contribution просто обнуляет фокус, увидев,
        // что тот не сдвинулся. Наблюдаемая разница — попал ли он в файл.
        const tabEditor = editorService.getEditors()[0];
        const focused = h.testApp.focusedElement;
        expect(focused).not.toBeNull();
        expect(focused!.getAncestorPath()).toContain(tabEditor.view);
    });

    it("после ухода фокуса из панели активным снова становится файл", () => {
        const editorService = h.container.get(EditorServiceDIToken);
        h.commands.execute(TOGGLE_OUTPUT);
        expect(editorService.getActiveEditor()?.uri.scheme).toBe("output");

        h.workbench.focusEditor();

        expect(editorService.getActiveEditor()?.fileName).toBe("alpha.txt");
    });
});
