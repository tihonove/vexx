import { Container } from "../../Common/DiContainer.ts";
import type { IClipboard } from "../../Common/IClipboard.ts";
import type { ILanguageService } from "../../Editor/Tokenization/ILanguageService.ts";
import type { ITokenStyleResolver } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import type { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import type { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { TuiApplication } from "../../TUIDom/TuiApplication.ts";

import { backendModule } from "./BackendModule.ts";
import { commandsModule } from "./CommandsModule.ts";
import { controllersModule } from "./ControllersModule.ts";
import { coreModule } from "./CoreModule.ts";
import { themeModule } from "./ThemeModule.ts";
import { tokenizationModule } from "./TokenizationModule.ts";

export interface ProductionProfileContext {
    app: TuiApplication;
    theme: WorkbenchTheme;
    clipboard: IClipboard;
    tokenizationRegistry: TokenizationRegistry;
    tokenStyleResolver: ITokenStyleResolver;
    languageService: ILanguageService;
}

/**
 * Production-профиль: полный набор сервисов с реальными реализациями
 * tokenization/language. Используется в `main.ts`.
 */
export function createProductionContainer(ctx: ProductionProfileContext): Container {
    return new Container()
        .use(coreModule, { app: ctx.app })
        .use(commandsModule)
        .use(themeModule, { theme: ctx.theme })
        .use(backendModule, { clipboard: ctx.clipboard })
        .use(tokenizationModule, {
            tokenizationRegistry: ctx.tokenizationRegistry,
            tokenStyleResolver: ctx.tokenStyleResolver,
            languageService: ctx.languageService,
        })
        .use(controllersModule);
}
