import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { NodeTerminalBackend } from "./Backend/NodeTerminalBackend.ts";
import type { ServiceAccessor } from "./Common/DiContainer.ts";
import { Container } from "./Common/DiContainer.ts";
import { InMemoryClipboard } from "./Common/InMemoryClipboard.ts";
import { AppController, AppControllerDIToken } from "./Controllers/AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./Controllers/CommandRegistry.ts";
import { ContextKeyService, ContextKeyServiceDIToken } from "./Controllers/ContextKeyService.ts";
import {
    ClipboardDIToken,
    LanguageServiceDIToken,
    ServiceAccessorDIToken,
    TokenizationRegistryDIToken,
    TokenStyleResolverDIToken,
    TuiApplicationDIToken,
} from "./Controllers/CoreTokens.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "./Controllers/EditorGroupController.ts";
import { KeybindingRegistry, KeybindingRegistryDIToken } from "./Controllers/KeybindingRegistry.ts";
import { StatusBarController, StatusBarControllerDIToken } from "./Controllers/StatusBarController.ts";
import { TokenizationRegistry } from "./Editor/Tokenization/TokenizationRegistry.ts";
import { ExtensionTokenizationContributor } from "./Extensions/ExtensionTokenizationContributor.ts";
import { scanBuiltinExtensions } from "./Extensions/ExtensionScanner.ts";
import { LanguageRegistry } from "./Extensions/LanguageRegistry.ts";
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

// ── Загрузка builtin-расширений ────────────────────────────
// Сканируем `src/Extensions/builtin/`, регистрируем contributes.languages в
// LanguageRegistry и contributes.grammars в TokenizationRegistry. Внешние
// расширения (~/.vexx/extensions/) — отдельная задача (см. docs/TODO/Extensions.md).
const here = path.dirname(fileURLToPath(import.meta.url));
const builtinExtensionsDir = path.resolve(here, "Extensions", "builtin");
const builtinExtensions = await scanBuiltinExtensions(builtinExtensionsDir);

const languageRegistry = new LanguageRegistry();
for (const ext of builtinExtensions) languageRegistry.register(ext);

const tokenizationRegistry = new TokenizationRegistry();
const tokenizationContributor = new ExtensionTokenizationContributor(builtinExtensions, tokenizationRegistry);
const grammarsLoading = tokenizationContributor.apply();

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
    .bind(LanguageServiceDIToken, () => languageRegistry)
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
