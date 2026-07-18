import { type ChildProcess, spawn } from "node:child_process";
import { createRequire } from "node:module";

import { token } from "../../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../../Common/Disposable.ts";
import type { ILogger } from "../../Common/Logging/ILogger.ts";
import { Uri } from "../../Common/Uri.ts";
import type { IGutterChangeDecoration } from "../../Editor/Decorations/IGutterChangeDecoration.ts";
import type { ICompletionRequest, ICoreCompletionItem } from "../../Editor/ICompletionSource.ts";
import type { IRange } from "../../Editor/IRange.ts";
import type { ISaveEdit, ISaveSnapshot } from "../../Editor/ISaveParticipant.ts";

import type { ICommandService } from "./ICommandService.ts";
import { type IEditorDecorationsService, NULL_EDITOR_DECORATIONS_SERVICE } from "./IEditorDecorationsService.ts";
import type { IEditorOptionsPatch, IEditorOptionsService } from "./IEditorOptionsService.ts";
import type { IExtensionRegistration } from "./IExtensionEntry.ts";
import { type IFileDecorationsService, NULL_FILE_DECORATIONS_SERVICE } from "./IFileDecorationsService.ts";
import type { IIpcEndpoint } from "./IpcMessageChannel.ts";
import { IpcMessageChannel } from "./IpcMessageChannel.ts";
import { type IThemeColorResolver, NULL_THEME_COLOR_RESOLVER } from "./IThemeColorResolver.ts";
import { RpcEndpoint } from "./RpcEndpoint.ts";
import {
    parseDecorationRanges,
    parseWireFileDecorations,
    requestCompletionItems,
    requestWillSaveEdits,
    type SerializedDecorationRenderOptions,
    themeColorIdOf,
} from "./WireTypes.ts";

export const ExtensionHostDIToken = token<ExtensionHost>("ExtensionHost");

/** Порог, выше которого снапшот документа не гоняется через will-save RPC (8 MB). */
const MAX_WILL_SAVE_TEXT_BYTES = 8 * 1024 * 1024;

/** Папка воркспейса, проецируемая в subprocess (`workspace.workspaceFolders`). */
export interface IWorkspaceFolderInfo {
    /** Ресурс папки как `uri.toString()` — настоящий uri, а не голый путь под именем uri. */
    readonly uri: string;
    readonly name: string;
    readonly index: number;
}

/**
 * Провайдер конфигурации для push-модели: host рассылает снапшот настроек и
 * папки воркспейса в subprocess (`getConfiguration(...).get(...)` в расширениях
 * синхронный, RPC-per-get невозможен). Внедряется в {@link ExtensionHost} из
 * {@link ../../Workbench/Modules/ExtensionHostModule.ts} поверх
 * `IConfigurationService`, чтобы не тянуть слой Configuration в рантайм host'а.
 */
export interface IExtensionHostConfigProvider {
    /** Полное слитое дерево настроек (`IConfigurationService.getValue()`). */
    getSnapshot(): unknown;
    /** Папки воркспейса (одна, из `process.cwd()`, пока нет multi-root). */
    getWorkspaceFolders(): readonly IWorkspaceFolderInfo[];
    /** Подписка на изменение настроек (live-reload); передаёт изменившиеся ключи. */
    onDidChange(cb: (affectedKeys: readonly string[]) => void): IDisposable;
}

export interface IExtensionHostOptions {
    /**
     * Команда и аргументы для запуска subprocess'а. По умолчанию вычисляется
     * автоматически (`process.execPath` + `process.execArgv` + main script).
     * Перекрывается в тестах.
     */
    readonly spawnArgs?: () => { command: string; args: string[]; env?: NodeJS.ProcessEnv };
    /**
     * Тайм-аут на ожидание `host.ready` от subprocess'а, мс. Default: 5000.
     */
    readonly readyTimeoutMs?: number;
    /**
     * Тайм-аут на graceful shutdown через `host.shutdown` перед `SIGTERM`. Default: 1500.
     */
    readonly shutdownTimeoutMs?: number;
    /**
     * Тайм-аут на ответ участника will-save (`workspace.willSaveTextDocument`), мс.
     * По истечении сохранение продолжается без правок расширения. Default: 1500.
     */
    readonly willSaveTimeoutMs?: number;
    /**
     * Тайм-аут на ответ провайдеров автодополнения
     * (`languages.provideCompletionItems`), мс. По истечении completion-UI
     * показывает пустой список. Default: 1500.
     */
    readonly completionTimeoutMs?: number;
    /**
     * Логгер для lifecycle-событий host'а (канал `extensions.host`). Подканалы
     * `extensions.host.rpc` / `.stdout` / `.stderr` берутся из {@link logService}, если передан.
     */
    readonly logger?: ILogger;
    /**
     * Логгер для trace каждого RPC-сообщения (канал `extensions.host.rpc`).
     */
    readonly rpcLogger?: ILogger;
    /**
     * Логгер для stdout subprocess'а (канал `extensions.host.stdout`). Если передан —
     * stdio[1] переключается в `"pipe"`; иначе остаётся `"inherit"`.
     */
    readonly stdoutLogger?: ILogger;
    /**
     * Логгер для stderr subprocess'а (канал `extensions.host.stderr`).
     */
    readonly stderrLogger?: ILogger;
    /**
     * Провайдер конфигурации для push в subprocess (`workspace.initialize` /
     * `workspace.configurationChanged`). Если не передан — конфиг не рассылается
     * (расширение видит только `configDefaults` из своего манифеста).
     */
    readonly configuration?: IExtensionHostConfigProvider;
    /**
     * Мост gutter change-bar декораций к открытым редакторам
     * (`editor.setDecorations`). Если не передан — {@link NULL_EDITOR_DECORATIONS_SERVICE}
     * (декорации редактора игнорируются).
     */
    readonly editorDecorations?: IEditorDecorationsService;
    /**
     * Мост файловых декораций к дереву (`window.fileDecorationsChanged`). Если не
     * передан — {@link NULL_FILE_DECORATIONS_SERVICE} (декорации файлов игнорируются).
     */
    readonly fileDecorations?: IFileDecorationsService;
    /**
     * Резолвер `vscode.ThemeColor` id → packed-RGB (+ событие смены темы). Если не
     * передан — {@link NULL_THEME_COLOR_RESOLVER} (все цвета не резолвятся).
     */
    readonly themeColorResolver?: IThemeColorResolver;
}

/**
 * Host-сторона extension subsystem'ы. Форкает один subprocess (через
 * `child_process.spawn(process.execPath, ..., { stdio: [...,'ipc'] })`) и
 * управляет жизненным циклом расширений через RPC поверх Node IPC-канала.
 *
 * Subprocess — это тот же бинарь / тот же main.ts с env-флагом
 * `VEXX_EXTENSION_HOST=1`; ранний branch в `main.ts` уводит управление в
 * `runExtensionHostSubprocess()`.
 *
 * Lifecycle:
 * - `registerExtension(reg)` — только запоминает регистрацию (`pending`) и
 *   заголовки команд для палитры; subprocess НЕ поднимается. Возвращает
 *   disposable для снятия расширения.
 * - `activateByEvent(event)` — активирует ещё не активные `pending`-расширения,
 *   чьи `activationEvents` содержат событие: лениво поднимает subprocess (если
 *   ещё не) и шлёт `host.activateExtension`. Идемпотентно.
 * - `unregisterExtension(id)` — `host.deactivateExtension`.
 * - `dispose()` — `host.shutdown` (best effort) → ждём exit → SIGTERM →
 *   SIGKILL fallback.
 */
export class ExtensionHost extends Disposable {
    private readonly editorOptions: IEditorOptionsService;
    private readonly commandService: ICommandService;
    /** Прокси-регистрации команд сабпроцесса в host CommandRegistry (по id). */
    private readonly proxyCommands = new Map<string, IDisposable>();
    /** Заголовки команд из contributes.commands (id → title) для видимости в палитре. */
    private readonly commandTitles = new Map<string, string>();
    private readonly options: Required<
        Pick<
            IExtensionHostOptions,
            "spawnArgs" | "readyTimeoutMs" | "shutdownTimeoutMs" | "willSaveTimeoutMs" | "completionTimeoutMs"
        >
    >;
    private readonly logger: ILogger | undefined;
    private readonly rpcLogger: ILogger | undefined;
    private readonly stdoutLogger: ILogger | undefined;
    private readonly stderrLogger: ILogger | undefined;
    private readonly configuration: IExtensionHostConfigProvider | undefined;
    private readonly editorDecorations: IEditorDecorationsService;
    private readonly fileDecorations: IFileDecorationsService;
    private readonly themeColorResolver: IThemeColorResolver;
    /** Реестр типов декораций: key → { overviewRulerColorId?, isWholeLine }. Gutter-тип = есть overviewRulerColor. */
    private readonly decorationTypes = new Map<number, { overviewRulerColorId?: string; isWholeLine: boolean }>();
    /** Держимые декорации редактора: uri → (key → ranges). Пере-резолвятся при смене темы. */
    private readonly editorDecorationsByFile = new Map<string, Map<number, readonly IRange[]>>();
    /** Держимые файловые декорации: absPath → { badge?, colorId? }. Пере-резолвятся при смене темы. */
    private readonly fileDecorationState = new Map<string, { badge?: string; colorId?: string }>();
    private readonly extensions = new Set<string>();
    /**
     * Зарегистрированные, но ещё не активированные расширения (id → reg).
     * Заполняется `registerExtension`, опустошается `activateByEvent` по мере
     * наступления событий активации. Ленивость: пока reg здесь, subprocess под
     * него не поднимается.
     */
    private readonly pending = new Map<string, IExtensionRegistration>();
    private subprocess: ChildProcess | null = null;
    private channel: IpcMessageChannel | null = null;
    private rpc: RpcEndpoint | null = null;
    private readyPromise: Promise<void> | null = null;
    private hostDisposed = false;
    /** Есть ли в субпроцессе активные подписки на will/did-save (см. `workspace.updateSubscriptions`). */
    private willSaveSubscribed = false;
    private didSaveSubscribed = false;
    /** Есть ли в субпроцессе зарегистрированные completion-провайдеры (см. `languages.updateSubscriptions`). */
    private completionSubscribed = false;

    public constructor(
        editorOptions: IEditorOptionsService,
        commandService: ICommandService,
        options: IExtensionHostOptions = {},
    ) {
        super();
        this.editorOptions = editorOptions;
        this.commandService = commandService;
        this.options = {
            spawnArgs: options.spawnArgs ?? defaultSpawnArgs,
            readyTimeoutMs: options.readyTimeoutMs ?? 5000,
            shutdownTimeoutMs: options.shutdownTimeoutMs ?? 1500,
            willSaveTimeoutMs: options.willSaveTimeoutMs ?? 1500,
            completionTimeoutMs: options.completionTimeoutMs ?? 1500,
        };
        this.logger = options.logger;
        this.rpcLogger = options.rpcLogger;
        this.stdoutLogger = options.stdoutLogger;
        this.stderrLogger = options.stderrLogger;
        this.configuration = options.configuration;
        this.editorDecorations = options.editorDecorations ?? NULL_EDITOR_DECORATIONS_SERVICE;
        this.fileDecorations = options.fileDecorations ?? NULL_FILE_DECORATIONS_SERVICE;
        this.themeColorResolver = options.themeColorResolver ?? NULL_THEME_COLOR_RESOLVER;
        // Смена темы → пере-резолв держимых декораций в обе поверхности.
        this.register(this.themeColorResolver.onDidChange(() => this.repushAllDecorations()));
    }

    /**
     * Запоминает регистрацию расширения (bookkeeping) — subprocess НЕ поднимается.
     * Реальная активация происходит лениво в {@link activateByEvent}, когда
     * наступает событие из `reg.activationEvents`. Заголовки команд регистрируем
     * сразу: команда расширения должна быть видна в палитре ещё до активации.
     */
    public registerExtension(reg: IExtensionRegistration): IDisposable {
        if (this.hostDisposed) throw new Error("ExtensionHost disposed");
        if (this.extensions.has(reg.id) || this.pending.has(reg.id)) {
            throw new Error(`Extension "${reg.id}" already registered`);
        }
        // Инвариант загрузки: ровно один способ (source XOR mainPath). Проверяем
        // синхронно на регистрации (fail-fast) — subprocess (`parseActivateParams`)
        // держит ту же проверку как defense-in-depth.
        if ((reg.source !== undefined) === (reg.mainPath !== undefined)) {
            throw new Error(`Extension "${reg.id}": exactly one of "source" or "mainPath" must be set`);
        }
        this.logger?.debug(`registerExtension(${reg.id})`, {
            mainPath: reg.mainPath,
            activationEvents: normalizeActivationEvents(reg.activationEvents),
        });
        // Заголовки команд из contributes.commands — нужны прокси-регистрации,
        // чтобы команда расширения показалась в палитре (см. commands.registerCommand).
        if (reg.commandTitles !== undefined) {
            for (const [id, title] of Object.entries(reg.commandTitles)) this.commandTitles.set(id, title);
        }
        this.pending.set(reg.id, reg);
        return {
            dispose: (): void => {
                if (this.pending.delete(reg.id)) return; // ещё не активировано
                if (!this.extensions.has(reg.id)) return;
                void this.unregisterExtension(reg.id);
            },
        };
    }

    /**
     * Активирует все ещё не активные `pending`-расширения, чьи `activationEvents`
     * содержат `event`. Идемпотентно: уже активные пропускаются. `event === "*"`
     * матчит расширения с `"*"` в списке событий (пустой список ⇒ трактуется как
     * `["*"]`). Именно здесь лениво поднимается subprocess и уходит
     * `host.activateExtension`.
     */
    public async activateByEvent(event: string): Promise<void> {
        // Disposed-случай покрыт неявно: dispose() чистит `pending`, поэтому
        // `toActivate` окажется пустым и метод выйдет до ensureSubprocess.
        const toActivate: IExtensionRegistration[] = [];
        for (const reg of this.pending.values()) {
            if (normalizeActivationEvents(reg.activationEvents).includes(event)) toActivate.push(reg);
        }
        if (toActivate.length === 0) return;
        // Спавним subprocess ОДИН раз до цикла: сбой хоста (spawn/ready) — это не
        // проблема конкретного расширения, он пробрасывается наверх.
        const rpc = await this.ensureSubprocess();
        for (const reg of toActivate) {
            // Второй guard на случай, если параллельный activateByEvent уже занялся им.
            if (!this.pending.delete(reg.id)) continue;
            // Per-extension изоляция: упавший `activate()` одного расширения не
            // блокирует активацию остальных и не роняет bootstrap (как в VS Code).
            try {
                await rpc.request("host.activateExtension", {
                    id: reg.id,
                    mainPath: reg.mainPath,
                    source: reg.source,
                    filename: reg.filename,
                    configDefaults: reg.configDefaults,
                });
                this.extensions.add(reg.id);
                this.logger?.info(`activated extension "${reg.id}"`);
            } catch (err) {
                this.logger?.error(`failed to activate extension "${reg.id}"`, err);
            }
        }
    }

    public async unregisterExtension(id: string): Promise<void> {
        if (!this.extensions.has(id)) return;
        this.extensions.delete(id);
        const rpc = this.rpc;
        /* v8 ignore start -- defensive: an extension can only be in `extensions` after ensureSubprocess set `rpc`; dispose() clears `extensions` before nulling `rpc`, so rpc is never null while the id is still registered */
        if (rpc === null) return;
        /* v8 ignore stop */
        try {
            await rpc.request("host.deactivateExtension", { id });
            this.logger?.info(`deactivated extension "${id}"`);
        } catch (err) {
            // subprocess мог уже умереть — игнорируем.
            this.logger?.debug(`deactivateExtension(${id}) ignored`, err);
        }
    }

    /**
     * Запрашивает у субпроцесса правки will-save (`onWillSaveTextDocument`).
     * Возвращает `[]`, если субпроцесса нет, никто не подписан, документ слишком
     * большой или расширение не ответило за `willSaveTimeoutMs`. Подключается в
     * `EditorService.saveParticipant` (wiring в module/харнессе).
     */
    public async willSaveTextDocument(snapshot: ISaveSnapshot): Promise<readonly ISaveEdit[]> {
        const rpc = this.rpc;
        if (rpc === null || !this.willSaveSubscribed) return [];
        // Guard: очень большой документ не гоняем через RPC (арх-решение плана).
        /* v8 ignore start -- защитный лимит на снапшот 8 МБ; открытие такого файла в редакторе неподъёмно для unit-теста */
        if (snapshot.text.length > MAX_WILL_SAVE_TEXT_BYTES) {
            this.logger?.warn("skipping will-save participant: document too large", {
                uri: snapshot.uri,
                length: snapshot.text.length,
            });
            return [];
        }
        /* v8 ignore stop */
        return requestWillSaveEdits(
            (method, params) => rpc.request(method, params),
            {
                uri: snapshot.uri,
                languageId: snapshot.languageId,
                version: snapshot.versionId,
                isDirty: snapshot.isDirty,
                text: snapshot.text,
                reason: 1, // TextDocumentSaveReason.Manual
                eol: snapshot.eol,
                encoding: snapshot.encoding,
            },
            this.options.willSaveTimeoutMs,
        );
    }

    /**
     * Уведомляет субпроцесс о состоявшемся сохранении (`onDidSaveTextDocument`).
     * No-op, если субпроцесса нет или никто не подписан.
     */
    public didSaveTextDocument(meta: { uri: string; languageId: string }): void {
        const rpc = this.rpc;
        if (rpc === null || !this.didSaveSubscribed) return;
        rpc.notify("workspace.didSaveTextDocument", meta);
    }

    /**
     * Запрашивает у субпроцесса элементы автодополнения для позиции курсора
     * (`languages.provideCompletionItems`). Возвращает `[]`, если субпроцесса нет,
     * никто не зарегистрировал провайдеры, документ слишком большой или расширение
     * не ответило за `completionTimeoutMs`. Подключается в
     * `EditorService.completionSource` (wiring в module/харнессе).
     */
    public async provideCompletionItems(req: ICompletionRequest): Promise<readonly ICoreCompletionItem[]> {
        const rpc = this.rpc;
        if (rpc === null || !this.completionSubscribed) return [];
        /* v8 ignore start -- защитный лимит на снапшот 8 МБ; открытие такого файла в редакторе неподъёмно для unit-теста */
        if (req.text.length > MAX_WILL_SAVE_TEXT_BYTES) {
            this.logger?.warn("skipping completion: document too large", {
                uri: req.uri,
                length: req.text.length,
            });
            return [];
        }
        /* v8 ignore stop */
        return requestCompletionItems(
            (method, params) => rpc.request(method, params),
            {
                uri: req.uri,
                languageId: req.languageId,
                text: req.text,
                line: req.line,
                character: req.character,
            },
            this.options.completionTimeoutMs,
        );
    }

    public hasExtension(id: string): boolean {
        return this.extensions.has(id);
    }

    public get extensionCount(): number {
        return this.extensions.size;
    }

    public override dispose(): void {
        if (this.hostDisposed) return;
        this.hostDisposed = true;
        this.pending.clear();
        this.extensions.clear();
        void this.shutdownSubprocess();
        super.dispose();
    }

    /**
     * Ленивая инициализация subprocess'а. Идемпотентна — параллельные вызовы
     * получают одну и ту же `readyPromise`.
     */
    private async ensureSubprocess(): Promise<RpcEndpoint> {
        if (this.rpc !== null && this.readyPromise !== null) {
            await this.readyPromise;
            return this.rpc;
        }
        const spec = this.options.spawnArgs();
        const stdoutMode: "pipe" | "inherit" = this.stdoutLogger !== undefined ? "pipe" : "inherit";
        const stderrMode: "pipe" | "inherit" = this.stderrLogger !== undefined ? "pipe" : "inherit";
        this.logger?.debug("spawning extension host subprocess", {
            command: spec.command,
            args: spec.args,
            stdio: ["ignore", stdoutMode, stderrMode, "ipc"],
        });
        const child = spawn(spec.command, spec.args, {
            stdio: ["ignore", stdoutMode, stderrMode, "ipc"],
            env: spec.env ?? { ...process.env, VEXX_EXTENSION_HOST: "1" },
        });
        if (child.stdout !== null && this.stdoutLogger !== undefined) {
            pipeStreamToLogger(child.stdout, this.stdoutLogger, "info");
        }
        if (child.stderr !== null && this.stderrLogger !== undefined) {
            pipeStreamToLogger(child.stderr, this.stderrLogger, "warn");
        }
        child.once("exit", (code, signal) => {
            this.logger?.info("extension host subprocess exited", { code, signal });
        });
        child.once("error", (err) => {
            this.logger?.error("extension host subprocess error", err);
        });
        const channel = new IpcMessageChannel(child as unknown as IIpcEndpoint);
        const rpc = new RpcEndpoint(channel, this.rpcLogger);
        this.installHostHandlers(rpc);

        this.subprocess = child;
        this.channel = channel;
        this.rpc = rpc;

        this.readyPromise = waitForReady(rpc, child, this.options.readyTimeoutMs).then(() => {
            this.logger?.info("extension host ready");
            // Push конфигурацию ДО стартового active-editor и первого
            // activateExtension: расширение читает getConfiguration уже в activate().
            if (this.configuration !== undefined) {
                rpc.notify("workspace.initialize", {
                    configuration: this.configuration.getSnapshot(),
                    workspaceFolders: this.configuration.getWorkspaceFolders(),
                });
            }
            // Send initial active editor state so that window.activeTextEditor
            // is correct before the first host.activateExtension call.
            rpc.notify("editor.activeEditorChanged", this.editorOptions.getActiveEditorMeta());
        });
        await this.readyPromise;
        return rpc;
    }

    private installHostHandlers(rpc: RpcEndpoint): void {
        rpc.handleRequest("editor.setOptions", (params): unknown => {
            const patch = sanitizeOptionsPatch(params);
            this.editorOptions.setActiveEditorOptions(patch);
            return null;
        });
        rpc.handleRequest("editor.getOptions", (): unknown => {
            return this.editorOptions.getActiveEditorOptions();
        });
        // Сабпроцесс просит исполнить команду ядра (напр. встроенную
        // editor.action.trimTrailingWhitespace). Нормализуем через Promise —
        // handler ядра может вернуть значение или thenable.
        rpc.handleRequest("commands.executeCommand", (params): unknown => {
            const { id, args } = parseCommandInvocation(params);
            return Promise.resolve(this.commandService.execute(id, args));
        });
        // Сабпроцесс зарегистрировал команду — заводим прокси в host-реестре,
        // который уводит исполнение обратно в сабпроцесс обратным RPC.
        rpc.handleNotification("commands.registerCommand", (params): void => {
            const id = parseCommandId(params);
            if (id === null) return;
            this.proxyCommands.get(id)?.dispose();
            this.proxyCommands.set(
                id,
                this.commandService.registerProxy(
                    id,
                    (args) => rpc.request("commands.executeCommand", { id, args }),
                    this.commandTitles.get(id),
                ),
            );
        });
        rpc.handleNotification("commands.unregisterCommand", (params): void => {
            const id = parseCommandId(params);
            if (id === null) return;
            this.proxyCommands.get(id)?.dispose();
            this.proxyCommands.delete(id);
        });
        this.register(
            this.editorOptions.onActiveEditorChanged((meta) => {
                rpc.notify("editor.activeEditorChanged", meta);
            }),
        );
        // Субпроцесс сообщает, есть ли подписчики на will/did-save. Без них хост
        // не гоняет RPC на сохранении (save остаётся синхронным).
        rpc.handleNotification("workspace.updateSubscriptions", (params) => {
            const p = params as { willSave?: unknown; didSave?: unknown };
            this.willSaveSubscribed = p.willSave === true;
            this.didSaveSubscribed = p.didSave === true;
        });
        // Субпроцесс сообщает, есть ли зарегистрированные completion-провайдеры.
        // Без них хост не гоняет RPC на Ctrl+Space.
        rpc.handleNotification("languages.updateSubscriptions", (params) => {
            const p = params as { hasCompletionProviders?: unknown };
            this.completionSubscribed = p.hasCompletionProviders === true;
        });
        rpc.handleNotification("window.showMessage", (params) => {
            const { severity, message } = params as { severity?: unknown; message?: unknown };
            const text = typeof message === "string" ? message : String(message);
            if (severity === "error") this.logger?.error(`[extension] ${text}`);
            else if (severity === "warn") this.logger?.warn(`[extension] ${text}`);
            else this.logger?.info(`[extension] ${text}`);
        });
        // ─── Decorations bridge (Chunk 4) ────────────────────────────────────
        // Субпроцесс завёл тип декорации. Регистрируем его форму: наличие
        // overviewRulerColor делает тип gutter change-bar'ом.
        rpc.handleNotification("window.createTextEditorDecorationType", (params) => {
            const p = params as { key?: unknown; options?: unknown };
            if (typeof p.key !== "number") return;
            const options: SerializedDecorationRenderOptions =
                typeof p.options === "object" && p.options !== null
                    ? (p.options as SerializedDecorationRenderOptions)
                    : {};
            const overviewRulerColorId = themeColorIdOf(options.overviewRulerColor);
            this.decorationTypes.set(p.key, {
                ...(overviewRulerColorId !== undefined ? { overviewRulerColorId } : {}),
                isWholeLine: options.isWholeLine === true,
            });
        });
        // Тип снят — гасим его декорации во всех файлах и пере-push.
        rpc.handleNotification("window.disposeTextEditorDecorationType", (params) => {
            const p = params as { key?: unknown };
            if (typeof p.key !== "number") return;
            this.decorationTypes.delete(p.key);
            const affected: string[] = [];
            for (const [uri, byKey] of this.editorDecorationsByFile) {
                if (byKey.delete(p.key)) affected.push(uri);
            }
            for (const uri of affected) this.pushEditorDecorations(uri);
        });
        // Набор диапазонов типа в ресурсе. Пере-резолвим ThemeColor и проталкиваем
        // gutter-декорации в редактор(ы) этого ресурса.
        rpc.handleNotification("editor.setDecorations", (params) => {
            const p = params as { key?: unknown; uri?: unknown; ranges?: unknown };
            if (typeof p.key !== "number" || typeof p.uri !== "string") return;
            const ranges = parseDecorationRanges(p.ranges);
            let byKey = this.editorDecorationsByFile.get(p.uri);
            if (byKey === undefined) {
                byKey = new Map();
                this.editorDecorationsByFile.set(p.uri, byKey);
            }
            if (ranges.length === 0) byKey.delete(p.key);
            else byKey.set(p.key, ranges);
            this.pushEditorDecorations(p.uri);
        });
        // Изменившиеся файловые декорации. Мержим в держимый набор (голый uri без
        // цвета/бейджа = снятие) и пере-push всего набора в дерево.
        rpc.handleNotification("window.fileDecorationsChanged", (params) => {
            const p = params as { decorations?: unknown };
            for (const d of parseWireFileDecorations(p.decorations)) {
                const filePath = fileUriToPath(d.uri);
                if (filePath === null) continue;
                if (d.badge === undefined && d.colorId === undefined) {
                    this.fileDecorationState.delete(filePath);
                } else {
                    this.fileDecorationState.set(filePath, {
                        ...(d.badge !== undefined ? { badge: d.badge } : {}),
                        ...(d.colorId !== undefined ? { colorId: d.colorId } : {}),
                    });
                }
            }
            this.pushFileDecorations();
        });
        const configuration = this.configuration;
        if (configuration !== undefined) {
            this.register(
                configuration.onDidChange((affectedKeys) => {
                    rpc.notify("workspace.configurationChanged", {
                        configuration: configuration.getSnapshot(),
                        affectedKeys,
                    });
                }),
            );
        }
    }

    /**
     * Схлопывает держимые декорации файла в gutter change-bar'ы (только
     * gutter-типы — есть overviewRulerColor) с пере-резолвом ThemeColor и
     * проталкивает их в редактор(ы) этого ресурса. Пустой набор снимает бары.
     */
    private pushEditorDecorations(uri: string): void {
        const byKey = this.editorDecorationsByFile.get(uri);
        const decorations: IGutterChangeDecoration[] = [];
        /* v8 ignore start -- defensive: pushEditorDecorations зовётся только для ресурсов с записью (setDecorations/disposeType/repushAll) */
        if (byKey === undefined) {
            this.editorDecorations.setGutterChangeDecorations(uri, decorations);
            return;
        }
        /* v8 ignore stop */
        for (const [key, ranges] of byKey) {
            const type = this.decorationTypes.get(key);
            if (type?.overviewRulerColorId === undefined) continue;
            const color = this.themeColorResolver.resolve(type.overviewRulerColorId);
            if (color === undefined) continue;
            // VS Code's dirty-diff draws modified lines dashed, added/deleted solid.
            const dashed = type.overviewRulerColorId === "editorGutter.modifiedBackground";
            for (const range of ranges) decorations.push({ range, color, ...(dashed ? { dashed: true } : {}) });
        }
        this.editorDecorations.setGutterChangeDecorations(uri, decorations);
    }

    /** Пере-резолвит держимые файловые декорации и проталкивает полный набор в дерево. */
    private pushFileDecorations(): void {
        const entries: { path: string; color?: number; badge?: string }[] = [];
        for (const [filePath, state] of this.fileDecorationState) {
            const color = state.colorId !== undefined ? this.themeColorResolver.resolve(state.colorId) : undefined;
            entries.push({
                path: filePath,
                ...(color !== undefined ? { color } : {}),
                ...(state.badge !== undefined ? { badge: state.badge } : {}),
            });
        }
        this.fileDecorations.setFileDecorations(entries);
    }

    /** Пере-push всех держимых декораций в обе поверхности (на смену темы). */
    private repushAllDecorations(): void {
        for (const uri of this.editorDecorationsByFile.keys()) this.pushEditorDecorations(uri);
        this.pushFileDecorations();
    }

    /** Снимает все прокси-регистрации команд (при смерти сабпроцесса). */
    private clearProxyCommands(): void {
        for (const disposable of this.proxyCommands.values()) {
            disposable.dispose();
        }
        this.proxyCommands.clear();
    }

    private async shutdownSubprocess(): Promise<void> {
        const rpc = this.rpc;
        const channel = this.channel;
        const child = this.subprocess;
        this.rpc = null;
        this.channel = null;
        this.subprocess = null;
        this.readyPromise = null;
        this.willSaveSubscribed = false;
        this.didSaveSubscribed = false;
        this.completionSubscribed = false;
        // Декорации принадлежали умирающему сабпроцессу — сбрасываем реестр, чтобы
        // респавн начинал с чистого листа (сами поверхности перерисует расширение).
        this.decorationTypes.clear();
        this.editorDecorationsByFile.clear();
        this.fileDecorationState.clear();
        // Прокси-команды указывали на умирающий сабпроцесс — снимаем их из
        // общего DI-синглтона CommandRegistry, чтобы не оставить висячие записи.
        this.clearProxyCommands();
        if (child === null) {
            rpc?.dispose();
            channel?.dispose();
            return;
        }
        const exit = waitForExit(child);
        /* v8 ignore start -- defensive: ensureSubprocess sets `subprocess` and `rpc` together and shutdownSubprocess captures them together, so a non-null child always implies a non-null rpc here */
        if (rpc !== null) {
            /* v8 ignore stop */
            try {
                await Promise.race([rpc.request("host.shutdown"), sleep(this.options.shutdownTimeoutMs)]);
            } catch {
                // ignore
            }
        }
        if (child.exitCode === null && !child.killed) {
            try {
                child.kill("SIGTERM");
            } catch {
                // ignore
            }
            await Promise.race([exit, sleep(500)]);
        }
        if (child.exitCode === null && !child.killed) {
            try {
                child.kill("SIGKILL");
            } catch {
                // ignore
            }
            await Promise.race([exit, sleep(500)]);
        }
        rpc?.dispose();
        channel?.dispose();
    }
}

/**
 * Нормализует `activationEvents`: пусто/отсутствует ⇒ `["*"]` (eager). Так
 * расширение без описанных событий сохраняет прежнее поведение — активируется
 * на общем стартовом `activateByEvent("*")`.
 */
function normalizeActivationEvents(events: readonly string[] | undefined): readonly string[] {
    return events !== undefined && events.length > 0 ? events : ["*"];
}

function sanitizeOptionsPatch(raw: unknown): IEditorOptionsPatch {
    if (typeof raw !== "object" || raw === null) return {};
    const obj = raw as { tabSize?: unknown; insertSpaces?: unknown; indentSize?: unknown };
    const patch: { tabSize?: number; insertSpaces?: boolean } = {};
    if (typeof obj.tabSize === "number" && Number.isFinite(obj.tabSize) && obj.tabSize > 0) {
        patch.tabSize = Math.floor(obj.tabSize);
    }
    // `indentSize` — алиас tabSize (Vexx пока не различает их): применяем только
    // если явного tabSize нет. editorconfig шлёт indent_size именно так.
    if (
        patch.tabSize === undefined &&
        typeof obj.indentSize === "number" &&
        Number.isFinite(obj.indentSize) &&
        obj.indentSize > 0
    ) {
        patch.tabSize = Math.floor(obj.indentSize);
    }
    if (typeof obj.insertSpaces === "boolean") {
        patch.insertSpaces = obj.insertSpaces;
    }
    return patch;
}

function parseCommandInvocation(raw: unknown): { id: string; args: unknown[] } {
    if (typeof raw !== "object" || raw === null) {
        throw new Error("commands.executeCommand: params must be an object");
    }
    const obj = raw as { id?: unknown; args?: unknown };
    if (typeof obj.id !== "string" || obj.id === "") {
        throw new Error("commands.executeCommand: id must be a non-empty string");
    }
    const args = Array.isArray(obj.args) ? (obj.args as unknown[]) : [];
    return { id: obj.id, args };
}

/**
 * Переводит wire-uri файловой декорации в абсолютный путь; `null` — если ресурс
 * не на диске. Субпроцесс шлёт `Uri.toString()`, разбираем тем же типом.
 *
 * Раньше не-file строки возвращались как есть («best-effort»), и схема уезжала в
 * ключ `fileDecorationState` (`git:/foo.ts?{...}`), где молча не совпадала ни с
 * одним путём дерева. Декорацию для не-file ресурса честнее отбросить: дерево
 * адресуется путями, показать там `git:`-ресурс всё равно нечем.
 */
function fileUriToPath(uri: string): string | null {
    const parsed = Uri.parse(uri);
    return parsed.scheme === "file" ? parsed.fsPath : null;
}

function parseCommandId(raw: unknown): string | null {
    if (typeof raw !== "object" || raw === null) return null;
    const obj = raw as { id?: unknown };
    return typeof obj.id === "string" && obj.id !== "" ? obj.id : null;
}

function defaultSpawnArgs(): { command: string; args: string[] } {
    if (detectIsSea()) {
        // В SEA-режиме сам бинарь = `process.execPath`; main script отсутствует.
        return { command: process.execPath, args: [] };
    }
    const mainScript = process.argv[1];
    if (typeof mainScript !== "string" || mainScript === "") {
        throw new Error("ExtensionHost: cannot determine main script for dev subprocess");
    }
    return { command: process.execPath, args: [...process.execArgv, mainScript] };
}

/**
 * `node:sea` доступен только через `require()` внутри SEA-сборки — статический
 * ESM-импорт падает с `ERR_UNKNOWN_BUILTIN_MODULE` даже в работающем SEA exe.
 * См. `Common/Assets/createDefaultAssetAccess.ts` за тот же паттерн.
 */
function detectIsSea(): boolean {
    try {
        const req = createRequire("file:///");
        const sea = req("node:sea") as { isSea(): boolean };
        return sea.isSea();
    } catch {
        return false;
    }
}

function waitForReady(rpc: RpcEndpoint, child: ChildProcess, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const handle = rpc.handleNotification("host.ready", () => {
            handle.dispose();
            cleanup();
            resolve();
        });
        const onExit = (code: number | null): void => {
            handle.dispose();
            cleanup();
            reject(new Error(`extension host subprocess exited before ready (code ${String(code)})`));
        };
        const timer = setTimeout(() => {
            handle.dispose();
            cleanup();
            reject(new Error(`extension host subprocess did not become ready in ${String(timeoutMs)}ms`));
        }, timeoutMs);
        const cleanup = (): void => {
            child.off("exit", onExit);
            clearTimeout(timer);
        };
        child.once("exit", onExit);
    });
}

function waitForExit(child: ChildProcess): Promise<void> {
    return new Promise((resolve) => {
        if (child.exitCode !== null || child.killed) {
            resolve();
            return;
        }
        child.once("exit", () => {
            resolve();
        });
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Линейно-буферизованная подписка на `Readable` (stdout/stderr subprocess'а).
 * Каждую полную строку (`\n`-delimited) пишем как одну запись лога. Хвост без
 * `\n` сбрасываем при `end`.
 */
function pipeStreamToLogger(stream: NodeJS.ReadableStream, logger: ILogger, level: "info" | "warn"): void {
    stream.setEncoding("utf8");
    let buffer = "";
    stream.on("data", (chunk: string) => {
        buffer += chunk;
        let nl = buffer.indexOf("\n");
        while (nl !== -1) {
            const line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.length > 0) {
                if (level === "warn") logger.warn(line);
                else logger.info(line);
            }
            nl = buffer.indexOf("\n");
        }
    });
    stream.on("end", () => {
        if (buffer.length > 0) {
            if (level === "warn") logger.warn(buffer);
            else logger.info(buffer);
            buffer = "";
        }
    });
}
