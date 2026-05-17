import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { NodeTerminalBackend } from "./Backend/NodeTerminalBackend.ts";
import { createDefaultAssetAccess } from "./Common/Assets/createDefaultAssetAccess.ts";
import { CompositeAssetAccess } from "./Common/Assets/CompositeAssetAccess.ts";
import { FsAssetAccess } from "./Common/Assets/FsAssetAccess.ts";
import type { IAssetAccess } from "./Common/Assets/IAssetAccess.ts";
import { CliArgsError, parseCliArgs, USAGE } from "./Common/CliArgs.ts";
import { OscClipboard } from "./Common/OscClipboard.ts";
import { resolveUserDataPaths } from "./Common/UserDataPaths.ts";
import { loadConfiguration } from "./Configuration/ConfigurationService.ts";
import { AppControllerDIToken } from "./Controllers/AppController.ts";
import { TuiApplicationDIToken } from "./Controllers/CoreTokens.ts";
import { createProductionContainer } from "./Controllers/Modules/ProductionProfile.ts";
import { TokenizationRegistry } from "./Editor/Tokenization/TokenizationRegistry.ts";
import { scanExtensions } from "./Extensions/ExtensionScanner.ts";
import { ExtensionTokenizationContributor } from "./Extensions/ExtensionTokenizationContributor.ts";
import { ExtensionHostDIToken } from "./Extensions/Host/ExtensionHost.ts";
import { runExtensionHostSubprocess } from "./Extensions/Host/ExtensionHostSubprocess.ts";
import type { IExtensionRegistration } from "./Extensions/Host/IExtensionEntry.ts";
import { LanguageRegistry } from "./Extensions/LanguageRegistry.ts";
import { mergeExtensions } from "./Extensions/mergeExtensions.ts";
import { darkPlusTheme } from "./Theme/themes/darkPlus.ts";
import { TokenThemeResolver } from "./Theme/Tokenization/TokenThemeResolver.ts";
import { WorkbenchTheme } from "./Theme/WorkbenchTheme.ts";
import { TuiApplication } from "./TUIDom/TuiApplication.ts";

// ── Subprocess branch ─────────────────────────────────────
// Если форкнул себя ExtensionHost'ом — уходим в subprocess entry до любых
// TUI/CLI инициализаций. Сигнал — env VEXX_EXTENSION_HOST=1, выставленный
// `ExtensionHost.ensureSubprocess()`.

if (process.env.VEXX_EXTENSION_HOST === "1") {
    await runExtensionHostSubprocess();
    // runExtensionHostSubprocess() возвращается, но процесс остаётся живым
    // на IPC-канале до disconnect/shutdown. Просто не идём в TUI-ветку.
} else {
    await runEditor();
}

async function runEditor(): Promise<void> {
// ── CLI ────────────────────────────────────────────────────

let cli;
try {
    cli = parseCliArgs(process.argv.slice(2));
} catch (err) {
    if (err instanceof CliArgsError) {
        console.error(err.message);
        console.error(USAGE);
        process.exit(2);
    }
    throw err;
}

if (cli.help) {
    console.log(USAGE);
    process.exit(0);
}

const filePaths = cli.positional;
if (filePaths.length === 0) {
    console.error("Usage: vexx <file> [file2] [file3] ...");
    console.error(USAGE);
    process.exit(1);
}

const resolvedPaths = filePaths.map((f) => path.resolve(f));

// ── User data: пути, настройки ─────────────────────────────

const userDataPaths = resolveUserDataPaths({
    userDataDir: cli.userDataDir,
    profile: cli.profile,
    homedir: os.homedir(),
});
const configurationService = await loadConfiguration(userDataPaths);

// ── Backend / Theme ────────────────────────────────────────

const backend = new NodeTerminalBackend();
const application = new TuiApplication(backend);
const clipboard = new OscClipboard(
    (seq) => {
        backend.writeOscSequence(seq);
    },
    (cb) => {
        backend.onOscResponse(cb);
    },
);

const initialTheme = WorkbenchTheme.fromThemeFile(darkPlusTheme);

// ── Загрузка расширений ────────────────────────────────────
// Builtin: либо SEA-bundle, либо `src/Extensions/builtin/` в dev.
// User: `<userData.root>/extensions/` через `FsAssetAccess`, замапленный
// на виртуальный префикс `UserExtensions/`. Оба источника склеиваются в
// один `IAssetAccess` через `CompositeAssetAccess`, чтобы все downstream
// потребители (`ExtensionTokenizationContributor`, грамматики и т.д.)
// видели единое адресное пространство.

const BUILTIN_PREFIX = "Extensions/builtin/";
const USER_PREFIX = "UserExtensions/";

const builtinAssets = createDefaultAssetAccess();
const userExtensionsAssets: IAssetAccess = new FsAssetAccess({
    [USER_PREFIX]: userDataPaths.extensionsDir,
});
const assets = new CompositeAssetAccess({
    "": builtinAssets,
    [USER_PREFIX]: userExtensionsAssets,
});

const builtinExtensions = await scanExtensions(assets, BUILTIN_PREFIX, { isBuiltin: true });
const userExtensions = fs.existsSync(userDataPaths.extensionsDir)
    ? await scanExtensions(assets, USER_PREFIX, { isBuiltin: false })
    : [];
const allExtensions = mergeExtensions(builtinExtensions, userExtensions);

const languageRegistry = new LanguageRegistry();
for (const ext of allExtensions) languageRegistry.register(ext);

const tokenizationRegistry = new TokenizationRegistry();
const tokenizationContributor = new ExtensionTokenizationContributor(assets, allExtensions, tokenizationRegistry);
const grammarsLoading = tokenizationContributor.apply();

// ── Bootstrap через DI-контейнер ────────────────────────────
const container = createProductionContainer({
    app: application,
    theme: initialTheme,
    clipboard,
    tokenizationRegistry,
    tokenStyleResolver: new TokenThemeResolver(initialTheme.tokenTheme),
    languageService: languageRegistry,
    configurationService,
});

const app = container.get(TuiApplicationDIToken);
const appController = container.get(AppControllerDIToken);
// Поднимаем extension host (пока без зарегистрированных расширений: исполнение
// `main` builtin-расширений будет в Phase F вместе с self-spawn).
const extensionHost = container.get(ExtensionHostDIToken);

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

// Активируем пользовательские расширения с `manifest.main` через extension host.
// ExtensionHost форкает subprocess и загружает модуль расширения там через
// `require(mainPath)`. Активация ПОСЛЕ openFile, чтобы activeTextEditor был
// доступен на момент `activate()`.
for (const ext of userExtensions) {
    if (typeof ext.manifest.main !== "string" || ext.manifest.main === "") continue;
    const dirName = ext.location.slice(USER_PREFIX.length).replace(/\/$/, "");
    const mainPath = path.resolve(userDataPaths.extensionsDir, dirName, ext.manifest.main);
    try {
        const reg: IExtensionRegistration = {
            id: ext.id,
            manifest: {
                name: ext.manifest.name,
                publisher: ext.manifest.publisher,
                version: ext.manifest.version,
            },
            mainPath,
        };
        await extensionHost.registerExtension(reg);
    } catch (err) {
        console.error(`[extensions] ${ext.id}: failed to activate`, err);
    }
}
}

