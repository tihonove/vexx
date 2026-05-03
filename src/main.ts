import * as fs from "node:fs";
import * as path from "node:path";

import { NodeTerminalBackend } from "./Backend/NodeTerminalBackend.ts";
import { createDefaultAssetAccess } from "./Common/Assets/createDefaultAssetAccess.ts";
import { InMemoryClipboard } from "./Common/InMemoryClipboard.ts";
import { AppControllerDIToken } from "./Controllers/AppController.ts";
import { TuiApplicationDIToken } from "./Controllers/CoreTokens.ts";
import { createProductionContainer } from "./Controllers/Modules/ProductionProfile.ts";
import { TokenizationRegistry } from "./Editor/Tokenization/TokenizationRegistry.ts";
import { scanBuiltinExtensions } from "./Extensions/ExtensionScanner.ts";
import { ExtensionTokenizationContributor } from "./Extensions/ExtensionTokenizationContributor.ts";
import { LanguageRegistry } from "./Extensions/LanguageRegistry.ts";
import { darkPlusTheme } from "./Theme/themes/darkPlus.ts";
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
// Источник ассетов: либо встроенный SEA-bundle (`vexx.bundle`), либо
// реальные файлы в `src/Extensions/builtin/` для dev/tests. См.
// `Common/Assets/createDefaultAssetAccess.ts`.
const assets = createDefaultAssetAccess();
const builtinExtensions = await scanBuiltinExtensions(assets, "Extensions/builtin/");

const languageRegistry = new LanguageRegistry();
for (const ext of builtinExtensions) languageRegistry.register(ext);

const tokenizationRegistry = new TokenizationRegistry();
const tokenizationContributor = new ExtensionTokenizationContributor(assets, builtinExtensions, tokenizationRegistry);
const grammarsLoading = tokenizationContributor.apply();

// ── Bootstrap через DI-контейнер ────────────────────────────
const container = createProductionContainer({
    app: application,
    theme: initialTheme,
    clipboard: new InMemoryClipboard(),
    tokenizationRegistry,
    tokenStyleResolver: new TokenThemeResolver(initialTheme.tokenTheme),
    languageService: languageRegistry,
});

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
