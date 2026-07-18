import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import type { IConfigurationService } from "../Configuration/IConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../Configuration/IConfigurationServiceDIToken.ts";
import type { IUserKeybindingRule } from "../Configuration/KeybindingsService.ts";
import type { ThemeRegistry } from "../Theme/ThemeRegistry.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeRegistryDIToken, ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import { WorkbenchLayoutElement } from "../TUIDom/Widgets/WorkbenchLayoutElement.ts";
import type { DialogService } from "../Workbench/Services/DialogService.ts";
import { DialogServiceDIToken } from "../Workbench/Services/DialogService.ts";
import type { LifecycleService } from "../Workbench/Services/LifecycleService.ts";
import { LifecycleServiceDIToken } from "../Workbench/Services/LifecycleService.ts";

import { quitAction } from "../Workbench/Actions/AppActions.ts";
import { builtinActions } from "../Workbench/Actions/builtinActions.ts";
import { registerAction } from "../Workbench/Actions/CommandAction.ts";
import type { CommandRegistry } from "../Workbench/Services/CommandRegistry.ts";
import { CommandRegistryDIToken } from "../Workbench/Services/CommandRegistry.ts";
import { CompletionServiceDIToken } from "../Workbench/Services/CompletionService.ts";
import { SuggestComponentDIToken } from "../Workbench/Components/Editor/SuggestComponent.ts";
import { ServiceAccessorDIToken, TuiApplicationDIToken } from "../Workbench/Services/CoreTokens.ts";
import {
    EditorGroupComponent,
    EditorGroupComponentDIToken,
} from "../Workbench/Components/Editor/EditorGroupComponent.ts";
import { EditorService, EditorServiceDIToken } from "../Workbench/Services/EditorService.ts";
import { ExplorerComponent, ExplorerComponentDIToken } from "../Workbench/Components/Explorer/ExplorerComponent.ts";
import { ExplorerService, ExplorerServiceDIToken } from "../Workbench/Services/ExplorerService.ts";
import { FileOperationsService, FileOperationsServiceDIToken } from "../Workbench/Services/FileOperationsService.ts";
import type { FileSearchService } from "../Workbench/Services/FileSearchService.ts";
import { FileSearchServiceDIToken } from "../Workbench/Services/FileSearchService.ts";
import { FindComponentDIToken } from "../Workbench/Components/Editor/FindComponent.ts";
import { FindServiceDIToken } from "../Workbench/Services/FindService.ts";
import type { IController } from "./IController.ts";
import type { KeybindingDispatcher } from "../Workbench/Services/KeybindingDispatcher.ts";
import { KeybindingDispatcherDIToken } from "../Workbench/Services/KeybindingDispatcher.ts";
import type { KeybindingRegistry } from "../Workbench/Services/KeybindingRegistry.ts";
import { KeybindingRegistryDIToken } from "../Workbench/Services/KeybindingRegistry.ts";
import type { LayoutService } from "../Workbench/Services/LayoutService.ts";
import { LayoutServiceDIToken } from "../Workbench/Services/LayoutService.ts";
import { MenuBarComponentDIToken } from "../Workbench/Components/Shell/MenuBarComponent.ts";
import { UserKeybindingsDIToken } from "./Modules/KeybindingsModule.ts";
import { PanelComponentDIToken } from "../Workbench/Components/Panel/PanelComponent.ts";
import { ProblemsComponentDIToken } from "../Workbench/Components/Panel/ProblemsComponent.ts";
import { TerminalPanelComponentDIToken } from "../Workbench/Components/Panel/TerminalPanelComponent.ts";
import { DiagnosticsServiceDIToken } from "../Workbench/Services/Diagnostics/DiagnosticsService.ts";
import { type TerminalService, TerminalServiceDIToken } from "../Workbench/Services/Terminal/TerminalService.ts";
import { QuickInputComponentDIToken } from "../Workbench/Components/QuickInput/QuickInputComponent.ts";
import type { QuickInputService } from "../Workbench/Services/QuickInputService.ts";
import { QuickInputServiceDIToken } from "../Workbench/Services/QuickInputService.ts";
import { QuickOpenServiceDIToken } from "../Workbench/Services/QuickOpenService.ts";
import { StatusBarComponent, StatusBarComponentDIToken } from "../Workbench/Components/StatusBar/StatusBarComponent.ts";
import { EditorStatusContributionDIToken } from "../Workbench/Services/EditorStatusContribution.ts";
import { TerminalEnvStatusContributionDIToken } from "../Workbench/Services/TerminalEnvironment/TerminalEnvStatusContribution.ts";
import type { TerminalEnvironmentService } from "../Workbench/Services/TerminalEnvironment/TerminalEnvironmentService.ts";
import { TerminalEnvironmentServiceDIToken } from "../Workbench/Services/TerminalEnvironment/TerminalEnvironmentService.ts";
import type { WorkbenchContextKeys } from "../Workbench/Services/WorkbenchContextKeys.ts";
import { WorkbenchContextKeysDIToken } from "../Workbench/Services/WorkbenchContextKeys.ts";
import type { WorkbenchStateService } from "../Workbench/Services/WorkbenchStateService.ts";
import { WorkbenchStateServiceDIToken } from "../Workbench/Services/WorkbenchStateService.ts";

export const AppControllerDIToken = token<AppController>("AppController");

/**
 * Корневой контроллер приложения — тонкая скорлупа над слоем Workbench:
 * конструирует корневую view (`BodyElement` + `WorkbenchLayoutElement`),
 * вставляет в неё view компонентов, прикрепляет late-init швы
 * (`attachHost`/`attachLayout`/`attachView`), регистрирует встроенные экшены и
 * ведёт bootstrap-жизненный цикл (mount → activate → open/restore файлов).
 * Логика живёт в сервисах Workbench; здесь остаются только квит-флоу
 * (`requestQuit` + `doQuit`: teardown TUI и `process.exit`) и применение темы к
 * собственным контролам (BodyElement/сэши).
 */
export class AppController extends Disposable implements IController {
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
    private themeService: ThemeService;
    private themeRegistry: ThemeRegistry;
    private terminalEnv: TerminalEnvironmentService;
    private dispatcher: KeybindingDispatcher;

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
        super();
        this.terminalEnv = terminalEnv;
        this.dialogService = this.register(dialogService);
        this.lifecycleService = lifecycleService;
        // Несохранённые редакторы участвуют в confirm-save последовательности выхода.
        this.lifecycleService.registerShutdownParticipant(editorService);
        this.themeService = themeService;
        this.themeRegistry = accessor.get(ThemeRegistryDIToken);
        this.editorService = this.register(editorService);
        // Editor-кластер: компонент группового контрола (tab strip + контент
        // активного редактора) поверх EditorService.
        this.editorGroupComponent = this.register(accessor.get(EditorGroupComponentDIToken));
        // Explorer-кластер: сервис (корень/провайдер/reveal) и компонент
        // (дерево + контекст-меню). AppController владеет их жизнью.
        this.explorerService = this.register(accessor.get(ExplorerServiceDIToken));
        this.explorerComponent = this.register(accessor.get(ExplorerComponentDIToken));
        // Клавиатурный диспатчер (Workbench-сервис): AppController владеет его жизнью
        // и подключает view-хук модальных оверлеев (хук контекст-ключей замыкает на
        // себя WorkbenchContextKeys) — сам сервис про view ничего не знает.
        this.dispatcher = this.register(accessor.get(KeybindingDispatcherDIToken));
        this.dispatcher.hasKeyboardCapturingOverlay = () => this.view.overlayLayer.hasKeyboardCapturingOverlay();
        this.configurationService = accessor.get(IConfigurationServiceDIToken);
        // QuickInput-кластер: файловый индекс, общий виджет-компонент (host
        // прикрепляется ниже, после постройки view), InputBox/list-pick сервис и
        // Quick Open поверх них. AppController владеет их жизнью.
        this.fileSearchService = this.register(accessor.get(FileSearchServiceDIToken));
        const quickInputComponent = this.register(accessor.get(QuickInputComponentDIToken));
        this.quickInput = accessor.get(QuickInputServiceDIToken);
        this.register(accessor.get(QuickOpenServiceDIToken));
        // Файловые операции (Workbench-сервис): промпт имени/пути — QuickInputService
        // (шов IExplorerInputPrompt замкнут в DI).
        this.fileOperations = accessor.get(FileOperationsServiceDIToken);
        // Find/Suggest-кластер: компоненты владеют виджетами и overlay-сессиями
        // (host'ы прикрепляются ниже, после постройки view), сервисы — логикой
        // поиска/автодополнения. AppController владеет их жизнью.
        const suggestComponent = this.register(accessor.get(SuggestComponentDIToken));
        this.register(accessor.get(CompletionServiceDIToken));
        const findComponent = this.register(accessor.get(FindComponentDIToken));
        this.register(accessor.get(FindServiceDIToken));
        this.statusBarComponent = this.register(statusBarComponent);
        // Contribution-сервисы статус-бара: инстанцируем через DI и владеем их жизнью.
        this.register(accessor.get(EditorStatusContributionDIToken));
        this.register(accessor.get(TerminalEnvStatusContributionDIToken));
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

        this.workbenchLayout = new WorkbenchLayoutElement();
        this.workbenchLayout.setSashHoverColor(themeService.theme.getRequiredColor("sash.hoverBorder"));
        this.workbenchLayout.setCenterContent(this.editorGroupComponent.view);
        this.workbenchLayout.setBottomPanel(panelComponent.view);
        this.layoutService.attachLayout(this.workbenchLayout);
        // Персист открытых редакторов (write-through подписан на EditorService
        // внутри сервиса; layout персистит LayoutService через onDidChangeLayout).
        this.workbenchState = this.register(accessor.get(WorkbenchStateServiceDIToken));

        this.view = new BodyElement();
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
        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
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
    }

    public mount(): void {
        // Capture-phase listeners run before the focused widget (the target),
        // so while a chord is in progress they can swallow keys entirely —
        // keeping them out of the editor whether or not they match a command.
        // Сама обработка живёт в KeybindingDispatcher (Workbench); AppController
        // лишь вешает его листенеры на корневое дерево, которым владеет. Фокус-
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

    private applyTheme(theme: WorkbenchTheme): void {
        this.view.style = {
            fg: theme.getRequiredColor("foreground"),
            bg: theme.getRequiredColor("editor.background"),
        };
        this.workbenchLayout.setSashHoverColor(theme.getRequiredColor("sash.hoverBorder"));
    }

    /**
     * Резолвит тему по имени из `workbench.colorTheme` и применяет её через
     * `ThemeService` (что дёрнет `onThemeChange` → {@link applyTheme}). Guard по
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
