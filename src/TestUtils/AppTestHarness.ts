import type { Container } from "../vs/platform/instantiation/common/instantiation.ts";
import { Size } from "../vs/base/common/geometry.ts";
import type { IStateService } from "../vs/platform/state/node/state.ts";
import type { AppController } from "../vs/workbench/tui/workbench.ts";
import { AppControllerDIToken } from "../vs/workbench/tui/workbench.ts";
import type { CommandRegistry } from "../vs/platform/commands/common/commands.ts";
import { CommandRegistryDIToken } from "../vs/platform/commands/common/commands.ts";
import { KeybindingsResourceDIToken, SettingsResourceDIToken } from "../vs/workbench/tui/coreTokens.ts";
import type { EditorController } from "../vs/workbench/tui/parts/editor/editorController.ts";
import { EditorGroupControllerDIToken } from "../vs/workbench/tui/parts/editor/editorGroupController.ts";
import { createTestContainer } from "../vs/vexx/modules/testProfile.ts";
import { StateServiceDIToken } from "../vs/vexx/modules/stateModule.ts";

import { TestApp } from "./TestApp.ts";

export interface IAppHarnessOptions {
    /** Передаётся в `controller.setWorkspaceFolder()` перед mount. Omit — путь «без воркспейса». */
    readonly workspaceFolder?: string;
    /** Размер терминала; по умолчанию 80×24. */
    readonly size?: Size;
    /** Абсолютный путь файла, который открыть после mount (`controller.openFile`). */
    readonly openFile?: string;
    /** Сфокусировать редактор и отрендерить кадр после boot'а. */
    readonly focusEditor?: boolean;
    /** Реальный {@link IStateService} для тестов персистентности; по умолчанию NULL (не персистит). */
    readonly stateService?: IStateService;
    /** Переопределить путь settings.json (по умолчанию `null` из TestProfile). */
    readonly settingsResource?: string;
    /** Переопределить путь keybindings.json (по умолчанию `null` из TestProfile). */
    readonly keybindingsResource?: string;
}

export interface IAppHarness {
    readonly testApp: TestApp;
    readonly controller: AppController;
    readonly commands: CommandRegistry;
    /** Полный контейнер — для suite-specific сервисов: `h.container.get(ThemeServiceDIToken)`. */
    readonly container: Container;
    /** Активный редактор группы; бросает, если его нет. */
    activeEditor(): EditorController;
    /** `controller.dispose()`. Воркспейсом НЕ владеет — композиция с {@link createTempWorkspace}. */
    dispose(): void;
}

/**
 * Boot-харнесс интеграционных тестов над {@link AppController}: тестовый
 * DI-контейнер → controller → mount → {@link TestApp} → bindApp. Канонический вид:
 *
 *     beforeEach(() => {
 *         ws = createTempWorkspace({ files: { "alpha.txt": "Alpha" } });
 *         h = createAppTestHarness({ workspaceFolder: ws.dir });
 *     });
 *     afterEach(() => { h.dispose(); ws.dispose(); });
 *
 * Харнесс синхронный: async-активация (`await controller.activate()` +
 * `fileIndexReady`) остаётся в тесте поверх харнесса.
 */
export function createAppTestHarness(options: IAppHarnessOptions = {}): IAppHarness {
    const { container, bindApp } = createTestContainer();
    // Rebind before the AppController is resolved (it reads these at construction).
    // По умолчанию состояние не персистится (NULL_STATE_SERVICE из stateModuleDefault);
    // тест может подсунуть реальный StateService, перебив биндинг ДО резолва AppController.
    if (options.stateService !== undefined) {
        const stateService = options.stateService;
        container.bind(StateServiceDIToken, () => stateService);
    }
    if (options.settingsResource !== undefined) {
        const resource = options.settingsResource;
        container.bind(SettingsResourceDIToken, () => resource);
    }
    if (options.keybindingsResource !== undefined) {
        const resource = options.keybindingsResource;
        container.bind(KeybindingsResourceDIToken, () => resource);
    }
    const controller = container.get(AppControllerDIToken);
    if (options.workspaceFolder !== undefined) {
        controller.setWorkspaceFolder(options.workspaceFolder);
    }
    controller.mount();
    const testApp = TestApp.create(controller.view, options.size ?? new Size(80, 24));
    bindApp(testApp.app);

    if (options.openFile !== undefined) {
        controller.openFile(options.openFile);
    }
    if (options.focusEditor === true) {
        controller.focusEditor();
        testApp.render();
    }

    const group = container.get(EditorGroupControllerDIToken);
    return {
        testApp,
        controller,
        commands: container.get(CommandRegistryDIToken),
        container,
        activeEditor: () => {
            const editor = group.getActiveEditor();
            /* v8 ignore start -- test helper: сценарий обязан открыть редактор до обращения к нему */
            if (editor === null) throw new Error("expected an active editor");
            /* v8 ignore stop */
            return editor;
        },
        dispose: () => {
            controller.dispose();
        },
    };
}
