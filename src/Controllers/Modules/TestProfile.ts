import { Container } from "../../Common/DiContainer.ts";
import { NULL_LANGUAGE_SERVICE } from "../../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { TuiApplication } from "../../TUIDom/TuiApplication.ts";
import { TuiApplicationDIToken } from "../CoreTokens.ts";

import { backendModuleDefault } from "./BackendModule.ts";
import { commandsModule } from "./CommandsModule.ts";
import { controllersModule } from "./ControllersModule.ts";
import { coreModuleLate } from "./CoreModule.ts";
import { themeModule } from "./ThemeModule.ts";
import { tokenizationModule } from "./TokenizationModule.ts";

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
        .use(commandsModule)
        .use(themeModule, { theme: WorkbenchTheme.fromThemeFile(darkPlusTheme) })
        .use(backendModuleDefault)
        .use(tokenizationModule, {
            tokenizationRegistry: new TokenizationRegistry(),
            tokenStyleResolver: NULL_TOKEN_STYLE_RESOLVER,
            languageService: NULL_LANGUAGE_SERVICE,
        })
        .use(controllersModule);

    return {
        container,
        bindApp: (app) => {
            container.bind(TuiApplicationDIToken, () => app);
        },
    };
}
