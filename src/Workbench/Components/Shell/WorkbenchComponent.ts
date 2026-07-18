import type { ServiceAccessor } from "../../../Common/DiContainer.ts";
import { token } from "../../../Common/DiContainer.ts";
import type { IConfigurationService } from "../../../Configuration/IConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../../../Configuration/IConfigurationServiceDIToken.ts";
import type { IUserKeybindingRule } from "../../../Configuration/KeybindingsService.ts";
import type { ThemeRegistry } from "../../../Theme/ThemeRegistry.ts";
import type { ThemeService } from "../../../Theme/ThemeService.ts";
import { ThemeRegistryDIToken, ThemeServiceDIToken } from "../../../Theme/ThemeTokens.ts";
import { BodyElement } from "../../../TUIDom/Widgets/BodyElement.ts";
import { WorkbenchLayoutElement } from "../../../TUIDom/Widgets/WorkbenchLayoutElement.ts";
import { quitAction } from "../../Actions/AppActions.ts";
import { builtinActions } from "../../Actions/builtinActions.ts";
import { registerAction } from "../../Actions/CommandAction.ts";
import { ThemedComponent } from "../../Component.ts";
import {
    WorkbenchContributionsRegistry,
    WorkbenchContributionsRegistryDIToken,
} from "../../Contributions/WorkbenchContributionsRegistry.ts";
import { UserKeybindingsDIToken } from "../../Modules/KeybindingsModule.ts";
import type { CommandRegistry } from "../../Services/CommandRegistry.ts";
import { CommandRegistryDIToken } from "../../Services/CommandRegistry.ts";
import { CompletionServiceDIToken } from "../../Services/CompletionService.ts";
import { ServiceAccessorDIToken, TuiApplicationDIToken } from "../../Services/CoreTokens.ts";
import { DiagnosticsServiceDIToken } from "../../Services/Diagnostics/DiagnosticsService.ts";
import type { DialogService } from "../../Services/DialogService.ts";
import { DialogServiceDIToken } from "../../Services/DialogService.ts";
import { EditorService, EditorServiceDIToken } from "../../Services/EditorService.ts";
import { ExplorerService, ExplorerServiceDIToken } from "../../Services/ExplorerService.ts";
import { FileOperationsService, FileOperationsServiceDIToken } from "../../Services/FileOperationsService.ts";
import type { FileSearchService } from "../../Services/FileSearchService.ts";
import { FileSearchServiceDIToken } from "../../Services/FileSearchService.ts";
import { FindServiceDIToken } from "../../Services/FindService.ts";
import type { KeybindingDispatcher } from "../../Services/KeybindingDispatcher.ts";
import { KeybindingDispatcherDIToken } from "../../Services/KeybindingDispatcher.ts";
import type { KeybindingRegistry } from "../../Services/KeybindingRegistry.ts";
import { KeybindingRegistryDIToken } from "../../Services/KeybindingRegistry.ts";
import type { LayoutService } from "../../Services/LayoutService.ts";
import { LayoutServiceDIToken } from "../../Services/LayoutService.ts";
import type { LifecycleService } from "../../Services/LifecycleService.ts";
import { LifecycleServiceDIToken } from "../../Services/LifecycleService.ts";
import type { QuickInputService } from "../../Services/QuickInputService.ts";
import { QuickInputServiceDIToken } from "../../Services/QuickInputService.ts";
import { QuickOpenServiceDIToken } from "../../Services/QuickOpenService.ts";
import { type TerminalService, TerminalServiceDIToken } from "../../Services/Terminal/TerminalService.ts";
import type { TerminalEnvironmentService } from "../../Services/TerminalEnvironment/TerminalEnvironmentService.ts";
import { TerminalEnvironmentServiceDIToken } from "../../Services/TerminalEnvironment/TerminalEnvironmentService.ts";
import type { WorkbenchContextKeys } from "../../Services/WorkbenchContextKeys.ts";
import { WorkbenchContextKeysDIToken } from "../../Services/WorkbenchContextKeys.ts";
import type { WorkbenchStateService } from "../../Services/WorkbenchStateService.ts";
import { WorkbenchStateServiceDIToken } from "../../Services/WorkbenchStateService.ts";
import { EditorGroupComponent, EditorGroupComponentDIToken } from "../Editor/EditorGroupComponent.ts";
import { FindComponentDIToken } from "../Editor/FindComponent.ts";
import { SuggestComponentDIToken } from "../Editor/SuggestComponent.ts";
import { ExplorerComponent, ExplorerComponentDIToken } from "../Explorer/ExplorerComponent.ts";
import { PanelComponentDIToken } from "../Panel/PanelComponent.ts";
import { ProblemsComponentDIToken } from "../Panel/ProblemsComponent.ts";
import { TerminalPanelComponentDIToken } from "../Panel/TerminalPanelComponent.ts";
import { QuickInputComponentDIToken } from "../QuickInput/QuickInputComponent.ts";
import { StatusBarComponent, StatusBarComponentDIToken } from "../StatusBar/StatusBarComponent.ts";

import { MenuBarComponentDIToken } from "./MenuBarComponent.ts";

export const WorkbenchComponentDIToken = token<WorkbenchComponent>("WorkbenchComponent");

/**
 * Корневой компонент приложения (аналог Workbench-части в VS Code): владеет
 * корневой view (`BodyElement` + `WorkbenchLayoutElement`), вставляет в неё view
 * компонентов, прикрепляет late-init швы (`attachHost`/`attachLayout`/
 * `attachView`), регистрирует встроенные экшены (`builtinActions`) и красит
 * собственные контролы (BodyElement/сэши) в {@link updateStyles}. Логика живёт
 * в сервисах Workbench.
 *
 * Единственный компонент с жизненным циклом за пределами конструктора: у корня
 * есть реальная bootstrap-последовательность, которую ведёт `main.ts`
 * (mount → activate → open/restore файлов) — см. {@link mount}/{@link activate}.
 * Здесь же остаётся квит-флоу ({@link requestQuit} + doQuit: teardown TUI и
 * `process.exit`).
 */
export class WorkbenchComponent extends ThemedComponent {
    public static dependencies = [
        EditorServiceDIToken,
        CommandRegistryDIToken,
        KeybindingRegistryDIToken,
        ServiceAccessorDIToken,
        StatusBarComponentDIToken,
        ThemeServiceDIToken,
        TerminalEnvironmentServiceDIToken,
        UserKeybindingsDIToken,
        DialogServiceDIToken,
        LifecycleServiceDIToken,
    ] as const;
    public readonly view: BodyElement;
    public readonly workbenchLayout: WorkbenchLayoutElement;

    private editorService: EditorService;
    private editorGroupComponent: EditorGroupComponent;
    private dialogService: DialogService;
    private lifecycleService: LifecycleService;
    private explorerService: ExplorerService;
    private explorerComponent: ExplorerComponent;
    private fileOperations: FileOperationsService;
    private configurationService: IConfigurationService;
    private fileSearchService: FileSearchService;
    private quickInput: QuickInputService;
    private statusBarComponent: StatusBarComponent;
    private terminalService: TerminalService;
    private layoutService: LayoutService;
    private workbenchContextKeys: WorkbenchContextKeys;
    private workbenchState: WorkbenchStateService;
    private commands: CommandRegistry;
    private themeRegistry: ThemeRegistry;
    private terminalEnv: TerminalEnvironmentService;
    private dispatcher: KeybindingDispatcher;
    private contributionsRegistry: WorkbenchContributionsRegistry;

    public constructor(
        editorService: EditorService,
        commands: CommandRegistry,
        keybindings: KeybindingRegistry,
        accessor: ServiceAccessor,
        statusBarComponent: StatusBarComponent,
        themeService: ThemeService,
        terminalEnv: TerminalEnvironmentService,
        userKeybindings: readonly IUserKeybindingRule[],
        dialogService: DialogService,
        lifecycleService: LifecycleService,
    ) {
        super(themeService);
        this.terminalEnv = terminalEnv;
        this.dialogService = this.register(dialogService);
        this.lifecycleService = lifecycleService;
        // Несохранённые редакторы участвуют в confirm-save последовательности выхода.
        this.lifecycleService.registerShutdownParticipant(editorService);
        this.themeRegistry = accessor.get(ThemeRegistryDIToken);
        this.editorService = this.register(editorService);
        // Editor-кластер: компонент группового контрола (tab strip + контент
        // активного редактора) поверх EditorService.
        this.editorGroupComponent = this.register(accessor.get(EditorGroupComponentDIToken));
        // Explorer-кластер: сервис (корень/провайдер/reveal) и компонент
        // (дерево + контекст-меню). WorkbenchComponent владеет их жизнью.
        this.explorerService = this.register(accessor.get(ExplorerServiceDIToken));
        this.explorerComponent = this.register(accessor.get(ExplorerComponentDIToken));
        // Клавиатурный диспатчер: WorkbenchComponent владеет его жизнью и подключает
        // view-хук модальных оверлеев (хук контекст-ключей замыкает на себя
        // WorkbenchContextKeys) — сам сервис про view ничего не знает.
        this.dispatcher = this.register(accessor.get(KeybindingDispatcherDIToken));
        this.dispatcher.hasKeyboardCapturingOverlay = () => this.view.overlayLayer.hasKeyboardCapturingOverlay();
        this.configurationService = accessor.get(IConfigurationServiceDIToken);
        // QuickInput-кластер: файловый индекс, общий виджет-компонент (host
        // прикрепляется ниже, после постройки view), InputBox/list-pick сервис и
        // Quick Open поверх них. WorkbenchComponent владеет их жизнью.
        this.fileSearchService = this.register(accessor.get(FileSearchServiceDIToken));
        const quickInputComponent = this.register(accessor.get(QuickInputComponentDIToken));
        this.quickInput = accessor.get(QuickInputServiceDIToken);
        this.register(accessor.get(QuickOpenServiceDIToken));
        // Файловые операции (Workbench-сервис): промпт имени/пути — QuickInputService
        // (шов IExplorerInputPrompt замкнут в DI).
        this.fileOperations = accessor.get(FileOperationsServiceDIToken);
        // Find/Suggest-кластер: компоненты владеют виджетами и overlay-сессиями
        // (host'ы прикрепляются ниже, после постройки view), сервисы — логикой
        // поиска/автодополнения. WorkbenchComponent владеет их жизнью.
        const suggestComponent = this.register(accessor.get(SuggestComponentDIToken));
        this.register(accessor.get(CompletionServiceDIToken));
        const findComponent = this.register(accessor.get(FindComponentDIToken));
        this.register(accessor.get(FindServiceDIToken));
        this.statusBarComponent = this.register(statusBarComponent);
        // Panel-кластер: диагностики (headless), реестр вкладок панели, Problems и
        // терминал. Порядок резолва задаёт порядок табов: PROBLEMS регистрирует
        // ProblemsComponent, TERMINAL — TerminalService.
        this.register(accessor.get(DiagnosticsServiceDIToken));
        this.register(accessor.get(ProblemsComponentDIToken));
        this.terminalService = this.register(accessor.get(TerminalServiceDIToken));
        const panelComponent = this.register(accessor.get(PanelComponentDIToken));
        this.register(accessor.get(TerminalPanelComponentDIToken));
        this.commands = commands;
        // Layout-логика (сайдбар/панель + персист layout'а) и контекст-ключи
        // workbench'а (фокус/сервисы → ContextKeyService; замыкают хук
        // dispatcher.updateContextKeys). Сам layout-элемент и корневую view
        // прикрепляем ниже, как только они построены.
        this.layoutService = this.register(accessor.get(LayoutServiceDIToken));
        this.workbenchContextKeys = this.register(accessor.get(WorkbenchContextKeysDIToken));
        // Реестр workbench-contributions: фич-проводка вынесена в самодостаточные
        // contribution-классы (статус-бар и пр.). Реестр инстанцирует их по фазам:
        // Restored — в mount(), Eventually — из main.ts после первого кадра.
        this.contributionsRegistry = this.register(accessor.get(WorkbenchContributionsRegistryDIToken));

        this.workbenchLayout = new WorkbenchLayoutElement();
        this.workbenchLayout.setCenterContent(this.editorGroupComponent.view);
        this.workbenchLayout.setBottomPanel(panelComponent.view);
        this.layoutService.attachLayout(this.workbenchLayout);
        // Персист открытых редакторов (write-through подписан на EditorService
        // внутри сервиса; layout персистит LayoutService через onDidChangeLayout).
        this.workbenchState = this.register(accessor.get(WorkbenchStateServiceDIToken));

        this.view = new BodyElement();
        this.view.id = "workbench";
        this.dialogService.attachHost(this.view);
        // Контекст-меню дерева Explorer'а открывается в overlay-слое корневой view.
        this.explorerComponent.attachHost(this.view);
        this.view.setContent(this.workbenchLayout);
        this.view.setStatusBar(this.statusBarComponent.view);
        // Источник фокуса для контекст-ключей — FocusManager корневой view.
        this.workbenchContextKeys.attachView(this.view);

        // Общий виджет QuickInput/QuickOpen живёт в overlay-слое корневой view.
        quickInputComponent.attachHost(this.view);
        // Suggest-попап — в глобальном overlay-слое (у каретки), find-виджет —
        // в локальном слое группы редакторов. Закрытие при смене активного
        // редактора сервисы делают сами (подписки на onActiveEditorChanged).
        suggestComponent.attachHost(this.view);
        findComponent.attachHost(this.editorGroupComponent.view);
        this.register(
            this.editorService.onActiveEditorChanged(() => {
                // Автоподсветка активного файла в дереве (`explorer.autoReveal`) —
                // сам флоу живёт в ExplorerService.
                this.explorerService.autoRevealActiveFile(
                    this.editorService.getActiveEditor()?.absoluteFilePath ?? null,
                );
            }),
        );
        this.register(
            commands.register("workbench.openFile", (absolutePath: unknown) => {
                this.editorService.openFile(absolutePath as string);
                this.workbenchContextKeys.update();
            }),
        );
        for (const action of builtinActions) {
            this.register(registerAction(commands, keybindings, accessor, action));
        }
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...quitAction,
                run: (a) => {
                    this.requestQuit(a);
                },
            }),
        );
        // Apply user keybindings AFTER all defaults so they take precedence (the registry
        // resolves the last-registered matching binding) and so `-command` unbinds can remove defaults.
        this.dispatcher.applyUserKeybindings(userKeybindings);

        // Главное меню строится ПОСЛЕ применения user keybindings: шорткаты
        // пунктов резолвятся из реестра биндингов на момент постройки модели.
        const menuBarComponent = this.register(accessor.get(MenuBarComponentDIToken));
        this.view.setMenuBar(menuBarComponent.view);
        // Live-reload: смена `workbench.colorTheme` в settings.json перекрашивает UI
        // без рестарта. Explorer-настройки (`explorer.*`) читаются on-demand, поэтому
        // отдельная подписка им не нужна — reload модели применяет их сам. Editor-
        // настройки перепримeняет EditorService.
        this.register(
            this.configurationService.onDidChangeConfiguration((event) => {
                if (!event.affectsConfiguration("workbench.colorTheme")) return;
                this.applyColorThemeFromConfiguration();
            }),
        );

        this.editorService.onEditorCreate = (editor) => {
            editor.contextMenuEntries = [
                {
                    label: "Copy",
                    shortcut: "Ctrl+C",
                    onSelect: () => {
                        this.commands.execute("editor.action.clipboardCopyAction");
                    },
                },
                {
                    label: "Cut",
                    shortcut: "Ctrl+X",
                    onSelect: () => {
                        this.commands.execute("editor.action.clipboardCutAction");
                    },
                },
                {
                    label: "Paste",
                    shortcut: "Ctrl+V",
                    onSelect: () => {
                        this.commands.execute("editor.action.clipboardPasteAction");
                    },
                },
                { type: "separator" },
                {
                    label: "Undo",
                    shortcut: "Ctrl+Z",
                    onSelect: () => {
                        this.commands.execute("undo");
                    },
                },
            ];
        };
        this.initStyles();
    }

    public mount(): void {
        // Фаза Restored: view построена, лёгкие сервисы готовы — инстанцируем
        // contribution'ы этой фазы (статус-бар и пр.). Между конструктором и mount
        // ни один редактор не открывается → эквивалентно прежней проводке в ctor.
        this.contributionsRegistry.instantiateByPhase("restored");
        // Capture-phase listeners run before the focused widget (the target),
        // so while a chord is in progress they can swallow keys entirely —
        // keeping them out of the editor whether or not they match a command.
        // Сама обработка живёт в KeybindingDispatcher; WorkbenchComponent лишь
        // вешает его листенеры на корневое дерево, которым владеет. Фокус-
        // события уходят в WorkbenchContextKeys (пересчёт контекст-ключей).
        this.view.addEventListener("keydown", this.dispatcher.handleKeyDownCapture, { capture: true });
        this.view.addEventListener("keypress", this.dispatcher.handleKeyPressCapture, { capture: true });
        this.view.addEventListener("keydown", this.dispatcher.handleKeyDown);
        this.view.addEventListener("keyup", this.dispatcher.handleKeyUp);
        this.view.addEventListener("focus", this.workbenchContextKeys.handleFocusChange, { capture: true });
        this.view.addEventListener("blur", this.workbenchContextKeys.handleFocusChange, { capture: true });
        this.editorService.onRequestConfirmClose = (index) => {
            const editor = this.editorService.getEditor(index);
            /* v8 ignore start -- defensive: the callback is only invoked synchronously with a valid tab index, so the editor always exists */
            if (!editor) return;
            /* v8 ignore stop */
            this.showConfirmSaveDialog(this.editorService.displayName(editor), {
                onSave: () => {
                    // Explicit "Save" while closing a modified tab: honour the
                    // user's edits even against an external change (overwrite),
                    // so choosing Save never silently drops their work.
                    void editor.save({ overwrite: true }).then(() => {
                        this.editorService.closeTab(index);
                    });
                },
                onDontSave: () => {
                    this.editorService.closeTab(index);
                },
                /* v8 ignore start -- placeholder no-op: cancelling keeps the editor open, nothing to do */
                onCancel: () => {
                    // noop
                },
                /* v8 ignore stop */
            });
        };
        // Применяем сохранённый layout до первого кадра (run() идёт после mount()).
        // Workspace-стор уже открыт: setWorkspaceFolder вызывается до mount().
        // restoreLayout также синхронизирует истину видимости панели в PanelService.
        this.layoutService.restoreLayout();
    }

    public async activate(): Promise<void> {
        // Terminal tier/modes are already detected synchronously (env vars) in the env
        // service constructor, so context keys are correct from the first keypress —
        // push them now. Then kick off the fire-and-forget keyboard-protocol probe; if it
        // confirms richer support it upgrades the tier via onDidChange. Nothing blocks here.
        this.workbenchContextKeys.update();
        this.terminalEnv.detect();
        await this.editorService.activate();
        await this.explorerService.refresh();
    }

    /**
     * Фаза Eventually: idle после первого кадра. Запускает `main.ts` через
     * `setImmediate` (mount() идёт до `app.run()`, поэтому из mount фаза сработала
     * бы раньше кадра). Инстанцирует отложенные/тяжёлые contribution'ы.
     */
    public runEventuallyPhase(): void {
        this.contributionsRegistry.instantiateByPhase("eventually");
    }

    public openFile(filePath: string): void {
        this.editorService.openFile(filePath);
        this.workbenchContextKeys.update();
    }

    /** Пути, которые откроет {@link restoreOpenEditors} — бутстрапу для прогрева грамматик. */
    public getOpenEditorsToRestore(): string[] {
        return this.workbenchState.getOpenEditorsToRestore();
    }

    /**
     * Восстанавливает открытые в прошлой сессии файлы этого воркспейса (реплей
     * сохранённых путей + активная вкладка). Вызывается из `main.ts`, только если
     * пользователь НЕ передал файлы в CLI (явные файлы перебивают сессию).
     */
    public restoreOpenEditors(): void {
        this.workbenchState.restoreOpenEditors();
        this.workbenchContextKeys.update();
    }

    public setWorkspaceFolder(dirPath: string): void {
        this.explorerService.setRootPath(dirPath);
        // Новые терминалы спавнятся в папке воркспейса.
        this.terminalService.setWorkingDirectory(dirPath);
        this.workbenchLayout.setLeftPanel(this.explorerComponent.view);
        // Открыть per-project стор состояния для этой папки (переключение флашит
        // предыдущий). Дальше layout/открытые файлы читаются/пишутся в него.
        this.workbenchState.openWorkspace(dirPath);
        // Fire-and-forget: the index builds in the background so startup and the
        // first render are not blocked. `fileIndexReady` exposes completion for
        // callers (and tests) that need the index populated.
        void this.fileSearchService.activate(dirPath);
    }

    /** Resolves when the background file index has finished its initial build. */
    public get fileIndexReady(): Promise<void> {
        return this.fileSearchService.ready;
    }

    public focusEditor(): void {
        this.editorService.focusEditor();
    }

    protected updateStyles(): void {
        this.view.style = {
            fg: this.theme.getRequiredColor("foreground"),
            bg: this.theme.getRequiredColor("editor.background"),
        };
        this.workbenchLayout.setSashHoverColor(this.theme.getRequiredColor("sash.hoverBorder"));
    }

    /**
     * Резолвит тему по имени из `workbench.colorTheme` и применяет её через
     * `ThemeService` (что дёрнет `onThemeChange` → {@link updateStyles}). Guard по
     * имени: если тема уже активна (напр. правку внёс сам theme-picker через
     * `updateUserValue`), лишнего перекраса не делаем. Неизвестное имя игнорируем.
     */
    private applyColorThemeFromConfiguration(): void {
        const name = this.configurationService.get<string>("workbench.colorTheme");
        if (name === undefined) return;
        if (name === this.themeService.theme.name) return;
        const theme = this.themeRegistry.resolve(name);
        if (theme) this.themeService.setTheme(theme);
    }

    public showConfirmSaveDialog(
        filename: string,
        callbacks: { onSave: () => void; onDontSave: () => void; onCancel: () => void },
    ): void {
        this.dialogService.showConfirmSaveDialog(filename, callbacks);
    }

    private doQuit(accessor: ServiceAccessor): void {
        accessor.get(TuiApplicationDIToken).backend.teardown();
        process.exit(0);
    }

    public requestQuit(accessor: ServiceAccessor): void {
        // Последовательность confirm-save живёт в LifecycleService; сам выход
        // (teardown TUI + process.exit) остаётся колбэком владельца приложения.
        void this.lifecycleService.requestQuit(() => {
            this.doQuit(accessor);
        });
    }
}
