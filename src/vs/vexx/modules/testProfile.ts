import { MockTerminalBackend } from "../../tui/backend/mockTerminalBackend.ts";
import { Container } from "../../platform/instantiation/common/instantiation.ts";
import { NULL_LANGUAGE_SERVICE } from "../../editor/common/languages/language.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../editor/common/languages/tokenStyleResolver.ts";
import { TokenizationRegistry } from "../../editor/common/tokenizationRegistry.ts";
import { darkPlusTheme } from "../../workbench/services/themes/common/themes/darkPlus.ts";
import { WorkbenchTheme } from "../../platform/theme/common/workbenchTheme.ts";
import type { TuiApplication } from "../../base/tui/tuiApplication.ts";
import { TuiApplicationDIToken } from "../../workbench/tui/coreTokens.ts";
import { terminalEnvironmentModule } from "../../workbench/terminalEnvironment/terminalEnvironmentModule.ts";

import { backendModuleDefault } from "./backendModule.ts";
import { commandsModule } from "./commandsModule.ts";
import { configurationModuleDefault } from "./configurationModule.ts";
import { controllersModule } from "./controllersModule.ts";
import { coreModuleLate } from "./coreModule.ts";
import { fileWatcherModuleDefault } from "./fileWatcherModule.ts";
import { keybindingsModuleDefault } from "./keybindingsModule.ts";
import { loggingModuleDefault } from "./loggingModule.ts";
import { markersModule } from "./markersModule.ts";
import { stateModuleDefault } from "./stateModule.ts";
import { themeModule } from "./themeModule.ts";
import { tokenizationModule } from "./tokenizationModule.ts";
import { workspaceModule } from "./workspaceModule.ts";

/**
 * Тестовый контейнер. Возвращает контейнер с подключёнными NULL-стабами для
 * tokenization/language и `darkPlusTheme`. `TuiApplicationDIToken` биндится
 * **позже** через `bindApp(testApp.app)` — порядок такой:
 *
 *     const { container, bindApp } = createTestContainer();
 *     const controller = container.get(AppControllerDIToken);
 *     controller.mount();
 *     const testApp = TestApp.create(controller.view, size);
 *     bindApp(testApp.app);
 */
export interface TestContainerHandle {
    container: Container;
    bindApp: (app: TuiApplication) => void;
}

export function createTestContainer(): TestContainerHandle {
    const container = new Container()
        .use(coreModuleLate)
        .use(loggingModuleDefault)
        .use(commandsModule)
        .use(themeModule, { theme: WorkbenchTheme.fromThemeFile(darkPlusTheme) })
        .use(backendModuleDefault)
        .use(tokenizationModule, {
            tokenizationRegistry: new TokenizationRegistry(),
            tokenStyleResolver: NULL_TOKEN_STYLE_RESOLVER,
            languageService: NULL_LANGUAGE_SERVICE,
        })
        .use(configurationModuleDefault)
        .use(stateModuleDefault)
        .use(terminalEnvironmentModule, { backend: new MockTerminalBackend() })
        .use(keybindingsModuleDefault)
        .use(workspaceModule)
        .use(fileWatcherModuleDefault)
        .use(markersModule, { settingsResource: null, keybindingsResource: null })
        .use(controllersModule);

    return {
        container,
        bindApp: (app) => {
            container.bind(TuiApplicationDIToken, () => app);
        },
    };
}
