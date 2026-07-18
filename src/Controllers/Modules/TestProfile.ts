import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { Container } from "../../Common/DiContainer.ts";
import { FakeTerminalSurface } from "../../TestUtils/FakeTerminalSurface.ts";
import { TerminalSessionFactoryDIToken } from "../../Workbench/Services/Terminal/TerminalSessionFactory.ts";
import { NULL_LANGUAGE_SERVICE } from "../../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { TuiApplication } from "../../TUIDom/TuiApplication.ts";
import { TuiApplicationDIToken } from "../../Workbench/Services/CoreTokens.ts";
import { terminalEnvironmentModule } from "../../Workbench/Services/TerminalEnvironment/TerminalEnvironmentModule.ts";

import { backendModuleDefault } from "./BackendModule.ts";
import { commandsModule } from "./CommandsModule.ts";
import { configurationModuleDefault } from "./ConfigurationModule.ts";
import { controllersModule } from "./ControllersModule.ts";
import { coreModuleLate } from "./CoreModule.ts";
import { fileWatcherModuleDefault } from "./FileWatcherModule.ts";
import { keybindingsModuleDefault } from "./KeybindingsModule.ts";
import { loggingModuleDefault } from "./LoggingModule.ts";
import { markersModule } from "./MarkersModule.ts";
import { stateModuleDefault } from "./StateModule.ts";
import { themeModule } from "./ThemeModule.ts";
import { tokenizationModule } from "./TokenizationModule.ts";
import { workspaceModule } from "./WorkspaceModule.ts";

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

    // Перебиваем прод-фабрику терминальных сессий на фейк: тесты не спавнят реальные
    // PTY. Каждый вызов возвращает свежий FakeTerminalSurface; тесты, которым нужен
    // доступ к созданным инстансам, перебивают биндинг локально своей фабрикой.
    container.bind(TerminalSessionFactoryDIToken, () => () => new FakeTerminalSurface());

    return {
        container,
        bindApp: (app) => {
            container.bind(TuiApplicationDIToken, () => app);
        },
    };
}
