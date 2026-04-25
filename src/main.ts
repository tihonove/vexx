import * as fs from "node:fs";
import * as path from "node:path";

import { NodeTerminalBackend } from "./Backend/NodeTerminalBackend.ts";
import type { ServiceAccessor } from "./Common/DiContainer.ts";
import { Container } from "./Common/DiContainer.ts";
import { InMemoryClipboard } from "./Common/InMemoryClipboard.ts";
import { AppController, AppControllerDIToken } from "./Controllers/AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./Controllers/CommandRegistry.ts";
import { ContextKeyService, ContextKeyServiceDIToken } from "./Controllers/ContextKeyService.ts";
import {
    ClipboardDIToken,
    ServiceAccessorDIToken,
    TokenizationRegistryDIToken,
    TokenStyleResolverDIToken,
    TuiApplicationDIToken,
} from "./Controllers/CoreTokens.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "./Controllers/EditorGroupController.ts";
import { KeybindingRegistry, KeybindingRegistryDIToken } from "./Controllers/KeybindingRegistry.ts";
import { StatusBarController, StatusBarControllerDIToken } from "./Controllers/StatusBarController.ts";
import { WordTokenizer } from "./Editor/Tokenization/builtin/WordTokenizer.ts";
import { BUILTIN_GRAMMAR_RECORDS, BUILTIN_LANGUAGES } from "./Editor/Tokenization/textmate/builtinGrammars.ts";
import { TextMateGrammarLoader } from "./Editor/Tokenization/textmate/TextMateGrammarLoader.ts";
import { TokenizationRegistry } from "./Editor/Tokenization/TokenizationRegistry.ts";
import { darkPlusTheme } from "./Theme/themes/darkPlus.ts";
import { ThemeService } from "./Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "./Theme/ThemeTokens.ts";
import { TokenThemeResolver } from "./Theme/Tokenization/TokenThemeResolver.ts";
import { WorkbenchTheme } from "./Theme/WorkbenchTheme.ts";
import { TuiApplication } from "./TUIDom/TuiApplication.ts";

// ── CLI: один или несколько файлов ──────────────────────────

const filePaths = process.argv.slice(2);
if (filePaths.length === 0) {
    console.error("Usage: vexx <file> [file2] [file3] ...");
    process.exit(1);
}

const resolvedPaths = filePaths.map((f) => path.resolve(f));
const backend = new NodeTerminalBackend();
const application = new TuiApplication(backend);

const initialTheme = WorkbenchTheme.fromThemeFile(darkPlusTheme);

// TextMate-грамматики регистрируются через общий loader. До завершения async
// загрузки `TokenizationRegistry` заполнен fallback-токенайзерами (WordTokenizer
// для JS-семейства, PlainTextTokenizer — по умолчанию через `pickTokenizer`).
const tokenizationRegistry = new TokenizationRegistry();
tokenizationRegistry.register("javascript", new WordTokenizer());

const grammarLoader = new TextMateGrammarLoader(BUILTIN_GRAMMAR_RECORDS);
const grammarsLoading = Promise.all(
    BUILTIN_LANGUAGES.map(async (lang) => {
        try {
            const support = await grammarLoader.loadSupport(lang.scopeName);
            if (support !== null) tokenizationRegistry.register(lang.languageId, support);
        } catch (err) {
            // Не валим bootstrap: оставляем fallback-токенайзер для этого языка.
            console.error(`Failed to load TextMate grammar for ${lang.languageId}:`, err);
        }
    }),
);

// ── Bootstrap через DI-контейнер ────────────────────────────
const container = new Container()
    .bind(TuiApplicationDIToken, () => application)
    .bind(ThemeServiceDIToken, () => new ThemeService(initialTheme))
    .bind(CommandRegistryDIToken, () => new CommandRegistry())
    .bind(KeybindingRegistryDIToken, () => new KeybindingRegistry())
    .bind(ContextKeyServiceDIToken, () => new ContextKeyService())
    .bind(ClipboardDIToken, () => new InMemoryClipboard())
    .bind(TokenizationRegistryDIToken, () => tokenizationRegistry)
    .bind(TokenStyleResolverDIToken, () => new TokenThemeResolver(initialTheme.tokenTheme))
    .bind(ServiceAccessorDIToken, (): ServiceAccessor => container)
    .bind(EditorGroupControllerDIToken, EditorGroupController)
    .bind(StatusBarControllerDIToken, StatusBarController)
    .bind(AppControllerDIToken, AppController);

const app = container.get(TuiApplicationDIToken);
const appController = container.get(AppControllerDIToken);

// If the first argument is a directory, use it as the workspace folder
const firstResolved = resolvedPaths[0];
if (fs.statSync(firstResolved, { throwIfNoEntry: false })?.isDirectory()) {
    appController.setWorkspaceFolder(firstResolved);
}

app.root = appController.view;
appController.mount();
app.run();
await appController.activate();
// Дожидаемся регистрации TextMate-грамматик до открытия первых файлов,
// чтобы при создании `DocumentTokenStore` уже был полноценный токенайзер.
await grammarsLoading;
for (const p of resolvedPaths) {
    if (!fs.statSync(p, { throwIfNoEntry: false })?.isDirectory()) {
        appController.openFile(p);
    }
}
appController.focusEditor();
