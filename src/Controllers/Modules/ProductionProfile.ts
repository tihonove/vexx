import type { ITerminalBackend } from "../../Backend/ITerminalBackend.ts";
import { Container } from "../../Common/DiContainer.ts";
import type { IClipboard } from "../../Common/IClipboard.ts";
import type { ILogService } from "../../Common/Logging/ILogService.ts";
import type { IConfigurationService } from "../../Configuration/IConfigurationService.ts";
import type { IUserKeybindingRule } from "../../Configuration/KeybindingsService.ts";
import type { ILanguageService } from "../../Editor/Tokenization/ILanguageService.ts";
import type { ITokenStyleResolver } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import type { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import type { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { TuiApplication } from "../../TUIDom/TuiApplication.ts";
import { terminalEnvironmentModule } from "../TerminalEnvironment/TerminalEnvironmentModule.ts";

import { backendModule } from "./BackendModule.ts";
import { commandsModule } from "./CommandsModule.ts";
import { configurationModule } from "./ConfigurationModule.ts";
import { controllersModule } from "./ControllersModule.ts";
import { coreModule } from "./CoreModule.ts";
import { extensionHostModule } from "./ExtensionHostModule.ts";
import { keybindingsModule } from "./KeybindingsModule.ts";
import { loggingModule } from "./LoggingModule.ts";
import { themeModule } from "./ThemeModule.ts";
import { tokenizationModule } from "./TokenizationModule.ts";

export interface ProductionProfileContext {
    app: TuiApplication;
    backend: ITerminalBackend;
    theme: WorkbenchTheme;
    clipboard: IClipboard;
    tokenizationRegistry: TokenizationRegistry;
    tokenStyleResolver: ITokenStyleResolver;
    languageService: ILanguageService;
    configurationService: IConfigurationService;
    userKeybindings: readonly IUserKeybindingRule[];
    logService: ILogService;
}

/**
 * Production-профиль: полный набор сервисов с реальными реализациями
 * tokenization/language. Используется в `main.ts`.
 */
export function createProductionContainer(ctx: ProductionProfileContext): Container {
    return new Container()
        .use(coreModule, { app: ctx.app })
        .use(loggingModule, { logService: ctx.logService })
        .use(commandsModule)
        .use(themeModule, { theme: ctx.theme })
        .use(backendModule, { clipboard: ctx.clipboard })
        .use(tokenizationModule, {
            tokenizationRegistry: ctx.tokenizationRegistry,
            tokenStyleResolver: ctx.tokenStyleResolver,
            languageService: ctx.languageService,
        })
        .use(configurationModule, { configurationService: ctx.configurationService })
        .use(terminalEnvironmentModule, { backend: ctx.backend })
        .use(keybindingsModule, { rules: ctx.userKeybindings })
        .use(controllersModule)
        .use(extensionHostModule);
}
