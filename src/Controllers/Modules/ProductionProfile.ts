import type { ITerminalBackend } from "../../Backend/ITerminalBackend.ts";
import { Container } from "../../Common/DiContainer.ts";
import type { IClipboard } from "../../Common/IClipboard.ts";
import type { ILogService } from "../../Common/Logging/ILogService.ts";
import type { RingBufferSink } from "../../Common/Logging/sinks/RingBufferSink.ts";
import type { IConfigurationService } from "../../Configuration/IConfigurationService.ts";
import type { IStateService } from "../../Configuration/IStateService.ts";
import type { IUserKeybindingRule } from "../../Configuration/KeybindingsService.ts";
import type { ILanguageService } from "../../Editor/Tokenization/ILanguageService.ts";
import type { ITokenStyleResolver } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import type { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import type { ThemeRegistry } from "../../Theme/ThemeRegistry.ts";
import type { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { TuiApplication } from "../../TUIDom/TuiApplication.ts";
import { terminalEnvironmentModule } from "../TerminalEnvironment/TerminalEnvironmentModule.ts";

import { backendModule } from "./BackendModule.ts";
import { commandsModule } from "./CommandsModule.ts";
import { configurationModule } from "./ConfigurationModule.ts";
import { controllersModule } from "./ControllersModule.ts";
import { coreModule } from "./CoreModule.ts";
import { extensionHostModule } from "./ExtensionHostModule.ts";
import { fileWatcherModule } from "./FileWatcherModule.ts";
import { keybindingsModule } from "./KeybindingsModule.ts";
import { loggingModule } from "./LoggingModule.ts";
import { markersModule } from "./MarkersModule.ts";
import { stateModule } from "./StateModule.ts";
import { themeModule } from "./ThemeModule.ts";
import { tokenizationModule } from "./TokenizationModule.ts";
import { workspaceModule } from "./WorkspaceModule.ts";

export interface ProductionProfileContext {
    app: TuiApplication;
    backend: ITerminalBackend;
    theme: WorkbenchTheme;
    themeRegistry: ThemeRegistry;
    clipboard: IClipboard;
    tokenizationRegistry: TokenizationRegistry;
    tokenStyleResolver: ITokenStyleResolver;
    languageService: ILanguageService;
    configurationService: IConfigurationService;
    stateService: IStateService;
    userKeybindings: readonly IUserKeybindingRule[];
    logService: ILogService;
    /** In-memory лог-буфер, уже подключённый к `logService` — источник Output-панели. */
    ringBuffer: RingBufferSink;
    /** Absolute path of the active-profile Vexx settings.json (for diagnostics scoping). */
    settingsResource: string;
    /** Absolute path of the active-profile Vexx keybindings.json (for the open-keybindings command). */
    keybindingsResource: string;
}

/**
 * Production-профиль: полный набор сервисов с реальными реализациями
 * tokenization/language. Используется в `main.ts`.
 */
export function createProductionContainer(ctx: ProductionProfileContext): Container {
    return new Container()
        .use(coreModule, { app: ctx.app })
        .use(loggingModule, { logService: ctx.logService, ringBuffer: ctx.ringBuffer })
        .use(commandsModule)
        .use(themeModule, { theme: ctx.theme, themeRegistry: ctx.themeRegistry })
        .use(backendModule, { clipboard: ctx.clipboard })
        .use(tokenizationModule, {
            tokenizationRegistry: ctx.tokenizationRegistry,
            tokenStyleResolver: ctx.tokenStyleResolver,
            languageService: ctx.languageService,
        })
        .use(configurationModule, { configurationService: ctx.configurationService })
        .use(stateModule, { stateService: ctx.stateService })
        .use(terminalEnvironmentModule, { backend: ctx.backend })
        .use(keybindingsModule, { rules: ctx.userKeybindings })
        .use(workspaceModule)
        .use(fileWatcherModule)
        .use(markersModule, { settingsResource: ctx.settingsResource, keybindingsResource: ctx.keybindingsResource })
        .use(controllersModule)
        .use(extensionHostModule);
}
