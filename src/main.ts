import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { HeadlessCaptureBackend } from "./Backend/HeadlessCaptureBackend.ts";
import { NodeTerminalBackend } from "./Backend/NodeTerminalBackend.ts";
import { CompositeAssetAccess } from "./Common/Assets/CompositeAssetAccess.ts";
import { joinVirtualPath } from "./Common/Assets/AssetBundleFormat.ts";
import { createDefaultAssetAccess } from "./Common/Assets/createDefaultAssetAccess.ts";
import { FsAssetAccess } from "./Common/Assets/FsAssetAccess.ts";
import type { IAssetAccess } from "./Common/Assets/IAssetAccess.ts";
import { isPackagedRuntime } from "./Common/Assets/PackagedRuntime.ts";
import type { ICliArgs } from "./Common/CliArgs.ts";
import { CliArgsError, parseCliArgs, USAGE } from "./Common/CliArgs.ts";
import { Size } from "./Common/GeometryPromitives.ts";
import { LogService } from "./Common/Logging/LogService.ts";
import { FileSink } from "./Common/Logging/sinks/FileSink.ts";
import { RingBufferSink } from "./Common/Logging/sinks/RingBufferSink.ts";
import { OscClipboard } from "./Common/OscClipboard.ts";
import { resolveUserDataPaths } from "./Common/UserDataPaths.ts";
import { VEXX_VERSION } from "./Common/Version.ts";
import { loadConfiguration } from "./Configuration/ConfigurationService.ts";
import { loadState } from "./Configuration/StateService.ts";
import { loadUserKeybindings } from "./Configuration/KeybindingsService.ts";
import { AppControllerDIToken } from "./Controllers/AppController.ts";
import { ChokidarFileWatcher } from "./Controllers/ChokidarFileWatcher.ts";
import { TuiApplicationDIToken } from "./Controllers/CoreTokens.ts";
import { EditorGroupControllerDIToken } from "./Controllers/EditorGroupController.ts";
import { createProductionContainer } from "./Controllers/Modules/ProductionProfile.ts";
import { TokenizationRegistry } from "./Editor/Tokenization/TokenizationRegistry.ts";
import { installVsix, listInstalledExtensions, uninstallExtension } from "./Extensions/ExtensionInstaller.ts";
import { scanExtensions } from "./Extensions/ExtensionScanner.ts";
import { ExtensionTokenizationContributor } from "./Extensions/ExtensionTokenizationContributor.ts";
import { ExtensionHostDIToken } from "./Extensions/Host/ExtensionHost.ts";
import { runExtensionHostSubprocess } from "./Extensions/Host/ExtensionHostSubprocess.ts";
import type { IExtensionRegistration } from "./Extensions/Host/IExtensionEntry.ts";
import type { ICommandContribution, IConfigurationContribution } from "./Extensions/IExtensionManifest.ts";
import { LanguageRegistry } from "./Extensions/LanguageRegistry.ts";
import { mergeExtensions } from "./Extensions/mergeExtensions.ts";
import { attachInspector } from "./Inspector/index.ts";
import type { InspectorDriver } from "./Inspector/InspectorDriver.ts";
import { createBuiltinThemeRegistry } from "./Theme/ThemeRegistry.ts";
import { DEFAULT_COLOR_THEME } from "./Theme/themes/builtinThemes.ts";
import { ThemeServiceDIToken } from "./Theme/ThemeTokens.ts";
import { TokenThemeResolver } from "./Theme/Tokenization/TokenThemeResolver.ts";
import { TuiApplication } from "./TUIDom/TuiApplication.ts";

// ── Subprocess branch ─────────────────────────────────────
// Если форкнул себя ExtensionHost'ом — уходим в subprocess entry до любых
// TUI/CLI инициализаций. Сигнал — env VEXX_EXTENSION_HOST=1, выставленный
// `ExtensionHost.ensureSubprocess()`.

if (process.env.VEXX_EXTENSION_HOST === "1") {
    runExtensionHostSubprocess();
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

    if (cli.version) {
        console.log(VEXX_VERSION);
        process.exit(0);
    }

    if (cli.help) {
        console.log(USAGE);
        process.exit(0);
    }

    // ── Управление расширениями ────────────────────────────────
    // Флаги --install/--uninstall/--list выполняются здесь и завершают процесс
    // до подъёма TUI (stdout ещё свободен). Приоритет install → uninstall → list.
    if (cli.installExtension !== undefined || cli.uninstallExtension !== undefined || cli.listExtensions) {
        await runExtensionManagement(cli);
        // runExtensionManagement всегда завершает процесс через process.exit.
    }

    const filePaths = cli.positional;
    if (filePaths.length === 0) {
        console.error("Usage: vexx <file> [file2] [file3] ...");
        console.error(USAGE);
        process.exit(1);
    }

    const resolvedPaths = filePaths.map((f) => path.resolve(f));

    // ── Logging ──────────────────────────────────────────────
    // Всегда поднимаем RingBufferSink (источник данных для будущей
    // Output-вкладки). FileSink — только в dev: пишем в ./vexx.log в cwd
    // с truncate при каждом запуске. Для агентов/разработчиков это удобный
    // debug-tool; в упакованных сборках файл вообще не создаётся — гейт идёт по
    // isPackagedRuntime(), а не isSeaBinary(): self-extract тоже прод, но не SEA.
    const logService = new LogService();
    logService.addSink(new RingBufferSink());
    if (!isPackagedRuntime()) {
        logService.addSink(new FileSink(path.resolve(process.cwd(), "vexx.log")));
    }
    const bootstrapLogger = logService.createLogger("bootstrap");
    const extensionsLogger = logService.createLogger("extensions");
    const configurationLogger = logService.createLogger("configuration");
    bootstrapLogger.info("vexx starting", { cwd: process.cwd(), files: filePaths.length });

    // ── User data: пути, настройки ─────────────────────────────

    const userDataPaths = resolveUserDataPaths({
        userDataDir: cli.userDataDir,
        profile: cli.profile,
        homedir: os.homedir(),
    });
    // Live-reload настроек: следим за settings.json, чтобы правки применялись без
    // рестарта. Отдельный экземпляр watcher'а (редакторные контроллеры получают свой
    // через FileWatcherModule — следят за другими файлами). Живёт всё время работы
    // приложения; fd освобождается ОС на выходе, как и у editor-watcher'ов.
    const settingsWatcher = new ChokidarFileWatcher();
    const configurationService = await loadConfiguration(userDataPaths, configurationLogger, settingsWatcher);
    const userKeybindings = await loadUserKeybindings(userDataPaths.keybindingsFile, configurationLogger);
    // Машинное состояние UI/сессии (открытые файлы, layout) — отдельно от настроек.
    const stateService = loadState(userDataPaths, configurationLogger);

    // ── Backend / Theme ────────────────────────────────────────

    // Headless: рендер в память + управление через инспектор, без реального
    // терминала. Иначе — обычный stdin/stdout-бэкенд.
    const headlessBackend = cli.headless
        ? new HeadlessCaptureBackend(new Size(cli.headless.cols, cli.headless.rows))
        : null;
    const backend = headlessBackend ?? new NodeTerminalBackend();
    const application = new TuiApplication(backend);
    const clipboard = new OscClipboard((seq) => {
        backend.writeOscSequence(seq);
    });

    // Реестр встроенных тем + выбор активной по `workbench.colorTheme`. Неизвестное
    // имя (тема из ещё не установленного расширения, опечатка) — откат на дефолт.
    const themeRegistry = createBuiltinThemeRegistry();
    const colorThemeLabel = configurationService.get<string>("workbench.colorTheme") ?? DEFAULT_COLOR_THEME;
    const initialTheme =
        themeRegistry.resolve(colorThemeLabel) ?? themeRegistry.resolve(DEFAULT_COLOR_THEME) ?? undefined;
    if (initialTheme === undefined) {
        throw new Error(`No built-in theme available (looked up "${colorThemeLabel}" and "${DEFAULT_COLOR_THEME}")`);
    }

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

    const builtinExtensions = await scanExtensions(assets, BUILTIN_PREFIX, { isBuiltin: true }, extensionsLogger);
    const userExtensions = fs.existsSync(userDataPaths.extensionsDir)
        ? await scanExtensions(assets, USER_PREFIX, { isBuiltin: false }, extensionsLogger)
        : [];
    const allExtensions = mergeExtensions(builtinExtensions, userExtensions, extensionsLogger);

    const languageRegistry = new LanguageRegistry();
    for (const ext of allExtensions) languageRegistry.register(ext);

    const tokenizationRegistry = new TokenizationRegistry();
    const tokenizationContributor = new ExtensionTokenizationContributor(
        assets,
        allExtensions,
        tokenizationRegistry,
        extensionsLogger,
    );
    // Только регистрация ленивых фабрик — грамматики парсятся по требованию.
    tokenizationContributor.apply();

    // ── Bootstrap через DI-контейнер ────────────────────────────
    const tokenStyleResolver = new TokenThemeResolver(initialTheme.tokenTheme);

    const container = createProductionContainer({
        app: application,
        backend,
        theme: initialTheme,
        themeRegistry,
        clipboard,
        tokenizationRegistry,
        tokenStyleResolver,
        languageService: languageRegistry,
        configurationService,
        stateService,
        userKeybindings,
        logService,
        settingsResource: userDataPaths.settingsFile,
        keybindingsResource: userDataPaths.keybindingsFile,
    });

    // Единственный якорь сброса состояния на диск: `process.exit(0)` (любой путь
    // выхода — quit, SIGINT в NodeTerminalBackend) фаерит "exit". Только синхронный
    // I/O — поэтому flushSync. Write-through держит in-memory стор актуальным, так
    // что здесь всегда сериализуется последнее состояние.
    process.on("exit", () => {
        try {
            stateService.flushSync();
        } catch {
            /* на выходе делать нечего — глотаем */
        }
    });

    // Смена цветовой темы должна перекрашивать и синтаксис: пересаживаем token-тему
    // в резолвер скоупов. Редакторы сами перерисовываются по своему
    // `ThemeService.onThemeChange` (deferred render), поэтому достаточно синхронно
    // обновить резолвер в этом же broadcast'е.
    container.get(ThemeServiceDIToken).onThemeChange((theme) => {
        tokenStyleResolver.setTheme(theme.tokenTheme);
    });

    const app = container.get(TuiApplicationDIToken);
    const appController = container.get(AppControllerDIToken);
    // Поднимаем extension host. Регистрация расширений с `manifest.main` (builtin +
    // user) — ниже, ПОСЛЕ setWorkspaceFolder + openFile (чтобы workspaceFolders и
    // activeTextEditor были доступны на момент `activate()`).
    const extensionHost = container.get(ExtensionHostDIToken);

    // If the first argument is a directory, use it as the workspace folder
    const firstResolved = resolvedPaths[0];
    if (fs.statSync(firstResolved, { throwIfNoEntry: false })?.isDirectory()) {
        appController.setWorkspaceFolder(firstResolved);
    }

    app.root = appController.view;
    appController.mount();
    app.run();

    // TUIDom-инспектор: поднимаем WebSocket-сервер только по `--inspect-tui`.
    // Сервер читает дерево лениво (на момент getDocument), поэтому ок поднять
    // его до openFile — клиент увидит актуальное дерево, когда подключится.
    // Логируем порт только в logService: писать в stderr нельзя — он уходит в
    // тот же pty и испортит TUI-рендер.
    if (cli.inspectTui !== undefined) {
        // В headless-режиме инспектор получает driver: инъекция ввода + захват
        // кадра. В обычном режиме driver нет — инспектор остаётся read-only.
        const driver: InspectorDriver | undefined =
            headlessBackend === null
                ? undefined
                : {
                      sendKey: (name) => {
                          headlessBackend.sendKey(name);
                      },
                      sendText: (text) => {
                          headlessBackend.sendPaste(text);
                      },
                      resize: (cols, rows) => {
                          headlessBackend.resize(new Size(cols, rows));
                      },
                      captureFrame: async () => {
                          // Слить кадр, отложенный на setImmediate (scheduleRender),
                          // прежде чем снять снимок.
                          await new Promise<void>((resolve) => setImmediate(resolve));
                          return headlessBackend.captureFrame();
                      },
                      shutdown: () => {
                          // Отложенно, чтобы RPC-ответ успел уйти до выхода.
                          setImmediate(() => {
                              try {
                                  extensionHost.dispose();
                              } finally {
                                  process.exit(0);
                              }
                          });
                      },
                  };
        const inspector = await attachInspector(app, cli.inspectTui, driver);
        bootstrapLogger.info("TUIDom inspector listening", {
            host: cli.inspectTui.host,
            port: inspector.port,
            headless: headlessBackend !== null,
        });
    }

    await appController.activate();
    const explicitFiles = resolvedPaths.filter((p) => !fs.statSync(p, { throwIfNoEntry: false })?.isDirectory());
    if (explicitFiles.length > 0) {
        // Явные файлы в CLI перебивают сохранённую сессию (как `code file.ts`).
        for (const p of explicitFiles) appController.openFile(p);
    } else {
        // Иначе восстанавливаем открытые файлы прошлой сессии этого воркспейса.
        appController.restoreOpenEditors();
    }
    appController.focusEditor();

    // Регистрируем пользовательские расширения с `manifest.main` в extension host.
    // `registerExtension` — только bookkeeping (subprocess не поднимается);
    // реальная активация — событийная (`activateByEvent` ниже) по `activationEvents`.
    // Регистрируем ПОСЛЕ openFile, чтобы к моменту стартовых событий activeTextEditor
    // был доступен на `activate()`.
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
                configDefaults: flattenConfigDefaults(ext.manifest.contributes?.configuration),
                commandTitles: collectCommandTitles(ext.manifest.contributes?.commands),
                activationEvents: ext.manifest.activationEvents,
            };
            extensionHost.registerExtension(reg);
        } catch (err) {
            extensionsLogger.error(`${ext.id}: failed to register`, err);
        }
    }

    // Регистрируем builtin code-расширения (например встроенный `git`): их
    // скомпилированный `out/extension.cjs` читаем из `assets` (dev — FsAssetAccess,
    // SEA — BundleAssetAccess, единый вызов) и грузим строкой-исходником, которую
    // subprocess компилирует в памяти через Module._compile — без записи на диск.
    for (const ext of builtinExtensions) {
        const main = ext.manifest.main;
        if (typeof main !== "string" || main === "") continue;
        try {
            const virtualPath = joinVirtualPath(ext.location, main);
            const source = await assets.readText(virtualPath);
            const reg: IExtensionRegistration = {
                id: ext.id,
                manifest: {
                    name: ext.manifest.name,
                    publisher: ext.manifest.publisher,
                    version: ext.manifest.version,
                },
                source,
                // Синтетический абсолютный путь-идентичность (реального файла под SEA нет).
                filename: `/${virtualPath}`,
                configDefaults: flattenConfigDefaults(ext.manifest.contributes?.configuration),
                commandTitles: collectCommandTitles(ext.manifest.contributes?.commands),
                activationEvents: ext.manifest.activationEvents,
            };
            extensionHost.registerExtension(reg);
        } catch (err) {
            extensionsLogger.error(`${ext.id}: failed to register (builtin)`, err);
        }
    }

    // Фаерим стартовые события активации. Порядок: eager `*` → `onLanguage:*` для
    // языка уже открытого активного редактора → `onStartupFinished`. Последующие
    // `onLanguage:*` (переключение/открытие вкладок) фаерит ExtensionHostModule
    // через `EditorGroupController.onActiveEditorChanged`. Расширения без
    // `activationEvents` трактуются как `["*"]` — активируются здесь же.
    // Per-extension сбои activate() изолирует сам ExtensionHost (log + continue);
    // здесь ловим host-level сбой (subprocess не поднялся) — редактор не должен
    // падать из-за нерабочего extension host'а, просто без расширений.
    try {
        await extensionHost.activateByEvent("*");
        const activeLanguageId = container.get(EditorGroupControllerDIToken).getActiveEditor()?.languageId;
        if (activeLanguageId !== undefined) {
            await extensionHost.activateByEvent(`onLanguage:${activeLanguageId}`);
        }
        await extensionHost.activateByEvent("onStartupFinished");
    } catch (err) {
        extensionsLogger.error("extension host activation failed", err);
    }

    // Остальные грамматики догружаем в фоне, чтобы переключение вкладки на другой
    // язык не ждало парсинга. setImmediate — уже после первого кадра и спавна
    // extension host'а, так что с критическим путём старта прогрев не конкурирует.
    setImmediate(() => {
        void tokenizationContributor.preloadAll();
    });
}

/**
 * Выполняет CLI-команду управления расширениями (--install/--uninstall/--list)
 * и завершает процесс. Работает по каталогу `<userData>/extensions` без подъёма
 * TUI; вывод — в stdout/stderr, коды выхода 0 (успех) / 1 (ошибка).
 */
async function runExtensionManagement(cli: ICliArgs): Promise<never> {
    const { extensionsDir } = resolveUserDataPaths({
        userDataDir: cli.userDataDir,
        profile: cli.profile,
        homedir: os.homedir(),
    });

    try {
        if (cli.installExtension !== undefined) {
            const vsixPath = path.resolve(cli.installExtension);
            const { id, version, previous } = await installVsix(vsixPath, extensionsDir);
            console.log(`Installed ${id}@${version}`);
            const removed = previous.filter((v) => v !== version);
            if (removed.length > 0) {
                console.log(`Removed previous version(s): ${removed.join(", ")}`);
            }
            process.exit(0);
        }

        if (cli.uninstallExtension !== undefined) {
            const id = cli.uninstallExtension;
            const { removed } = uninstallExtension(id, extensionsDir);
            if (removed.length === 0) {
                console.error(`Extension ${id} is not installed`);
                process.exit(1);
            }
            console.log(`Uninstalled ${id} (${removed.length} version(s))`);
            process.exit(0);
        }

        // --list-extensions
        for (const ext of listInstalledExtensions(extensionsDir)) {
            console.log(`${ext.id}@${ext.version}`);
        }
        process.exit(0);
    } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}

/**
 * Сплющивает `contributes.configuration` расширения в dotted-map дефолтов
 * (`{ "editorconfig.generateAuto": true }`). Ключи `properties` — уже полные
 * dotted-пути настроек. Блок может быть объектом или массивом объектов.
 */
function flattenConfigDefaults(
    configuration: IConfigurationContribution | readonly IConfigurationContribution[] | undefined,
): Record<string, unknown> | undefined {
    if (configuration === undefined) return undefined;
    const blocks = Array.isArray(configuration) ? configuration : [configuration];
    const defaults: Record<string, unknown> = {};
    for (const block of blocks as readonly IConfigurationContribution[]) {
        const properties = block.properties;
        if (properties === undefined) continue;
        for (const [key, schema] of Object.entries(properties) as [string, unknown][]) {
            if (schema !== null && typeof schema === "object" && "default" in schema) {
                defaults[key] = schema.default;
            }
        }
    }
    return Object.keys(defaults).length > 0 ? defaults : undefined;
}

/**
 * Собирает `contributes.commands` в map id → title, чтобы host завёл прокси
 * рантайм-команд с заголовком (иначе команда исполнима, но не видна в палитре).
 */
function collectCommandTitles(
    commands: readonly ICommandContribution[] | undefined,
): Record<string, string> | undefined {
    if (commands === undefined || commands.length === 0) return undefined;
    const titles: Record<string, string> = {};
    for (const cmd of commands) {
        if (typeof cmd.command === "string" && typeof cmd.title === "string") {
            titles[cmd.command] = cmd.title;
        }
    }
    return Object.keys(titles).length > 0 ? titles : undefined;
}
