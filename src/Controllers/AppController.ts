import * as fs from "node:fs";
import * as path from "node:path";

import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { token } from "../Common/DiContainer.ts";
import { Uri } from "../Common/Uri.ts";
import { Disposable } from "../Common/Disposable.ts";
import type { ILogger } from "../Common/Logging/ILogger.ts";
import type { ILogService } from "../Common/Logging/ILogService.ts";
import { ILogServiceDIToken } from "../Common/Logging/ILogServiceDIToken.ts";
import type { IConfigurationService } from "../Configuration/IConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../Configuration/IConfigurationServiceDIToken.ts";
import type { IUserKeybindingRule } from "../Configuration/KeybindingsService.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import type { ThemeRegistry } from "../Theme/ThemeRegistry.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeRegistryDIToken, ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { TUIFocusEvent } from "../TUIDom/Events/TUIFocusEvent.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import { InputElement } from "../TUIDom/Widgets/InputElement.ts";
import type { MenuBarItem } from "../TUIDom/Widgets/MenuBarElement.ts";
import { MenuBarElement } from "../TUIDom/Widgets/MenuBarElement.ts";
import type { MenuEntry, MenuItemEntry } from "../TUIDom/Widgets/PopupMenuElement.ts";
import { TerminalViewElement } from "../TUIDom/Widgets/Terminal/TerminalViewElement.ts";
import { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";
import { WorkbenchLayoutElement } from "../TUIDom/Widgets/WorkbenchLayoutElement.ts";
import type { ConfirmDialogOptions } from "../Workbench/Components/Dialogs/ConfirmDialog.tsx";
import type { DialogService } from "../Workbench/Services/DialogService.ts";
import { DialogServiceDIToken } from "../Workbench/Services/DialogService.ts";
import type { LifecycleService } from "../Workbench/Services/LifecycleService.ts";
import { LifecycleServiceDIToken } from "../Workbench/Services/LifecycleService.ts";
import { getMenuStyles } from "../Workbench/Styles/defaultStyles.ts";

import { quitAction } from "./Actions/AppActions.ts";
import { clipboardCopyAction, clipboardCutAction, clipboardPasteAction } from "./Actions/ClipboardActions.ts";
import { showEditorContextMenuAction } from "../Workbench/Actions/ContextMenuActions.ts";
import {
    fileDeleteAction,
    fileRedoAction,
    fileRenameAction,
    fileUndoAction,
    refreshExplorerAction,
    showExplorerContextMenuAction,
} from "../Workbench/Actions/FileTreeActions.ts";
import {
    fileCopyAction,
    fileCopyPathAction,
    fileCopyRelativePathAction,
    fileCutAction,
    filePasteAction,
} from "../Workbench/Actions/FileTreeClipboardActions.ts";
import { explorerNewFileAction, explorerNewFolderAction } from "../Workbench/Actions/FileTreeCreateActions.ts";
import {
    cursorBottomAction,
    cursorBottomSelectAction,
    cursorDownAction,
    cursorDownSelectAction,
    cursorEndAction,
    cursorEndSelectAction,
    cursorHomeAction,
    cursorHomeSelectAction,
    cursorLeftAction,
    cursorLeftSelectAction,
    cursorPageDownAction,
    cursorPageDownSelectAction,
    cursorPageUpAction,
    cursorPageUpSelectAction,
    cursorRightAction,
    cursorRightSelectAction,
    cursorTopAction,
    cursorTopSelectAction,
    cursorUpAction,
    cursorUpSelectAction,
    cursorWordLeftAction,
    cursorWordLeftSelectAction,
    cursorWordRightAction,
    cursorWordRightSelectAction,
    scrollLineDownAction,
    scrollLineUpAction,
} from "./Actions/EditorActions.ts";
import {
    deleteLeftAction,
    deleteRightAction,
    deleteWordLeftAction,
    deleteWordRightAction,
    indentLinesAction,
    outdentLinesAction,
    redoAction,
    selectAllAction,
    undoAction,
} from "./Actions/EditorEditActions.ts";
import { changeEncodingAction } from "../Workbench/Actions/EncodingActions.ts";
import { changeEolAction, convertToCrlfAction, convertToLfAction, toggleEolAction } from "../Workbench/Actions/EolActions.ts";
import { fileSaveAction, fileSaveAsAction, newUntitledFileAction } from "./Actions/FileActions.ts";
import { fileOpenAction, fileOpenFolderAction } from "../Workbench/Actions/FileActions.ts";
import { closeFindWidgetAction, findAction, nextMatchAction, previousMatchAction } from "./Actions/FindActions.ts";
import {
    acceptSelectedSuggestionAction,
    hideSuggestWidgetAction,
    selectNextPageSuggestionAction,
    selectNextSuggestionAction,
    selectPrevPageSuggestionAction,
    selectPrevSuggestionAction,
} from "./Actions/SuggestActions.ts";
import {
    foldAction,
    foldAllAction,
    foldLevelActions,
    foldRecursivelyAction,
    gotoNextFoldAction,
    gotoPreviousFoldAction,
    toggleFoldAction,
    unfoldAction,
    unfoldAllAction,
    unfoldRecursivelyAction,
} from "./Actions/FoldingActions.ts";
import {
    inputCopyAction,
    inputCursorEndAction,
    inputCursorHomeAction,
    inputCursorLeftAction,
    inputCursorRightAction,
    inputCursorWordLeftAction,
    inputCursorWordRightAction,
    inputCutAction,
    inputDeleteLeftAction,
    inputDeleteRightAction,
    inputDeleteWordLeftAction,
    inputDeleteWordRightAction,
    inputPasteAction,
    inputRedoAction,
    inputSelectAllAction,
    inputSelectLeftAction,
    inputSelectRightAction,
    inputSelectToEndAction,
    inputSelectToHomeAction,
    inputSelectWordLeftAction,
    inputSelectWordRightAction,
    inputUndoAction,
} from "./Actions/InputActions.ts";
import {
    listFocusFirstAction,
    listFocusLastAction,
    listFocusPageDownAction,
    listFocusPageUpAction,
} from "./Actions/ListActions.ts";
import { openKeybindingsAction, openSettingsAction } from "./Actions/PreferencesActions.ts";
import { gotoLineAction, quickOpenAction, showCommandsAction } from "../Workbench/Actions/QuickOpenActions.ts";
import { closeActiveEditorAction, nextEditorInGroupAction, previousEditorInGroupAction } from "./Actions/TabActions.ts";
import { selectThemeAction } from "../Workbench/Actions/ThemeActions.ts";
import {
    insertFinalNewLineAction,
    triggerSuggestAction,
    trimTrailingWhitespaceAction,
} from "./Actions/WhitespaceActions.ts";
import { registerAction } from "../Workbench/Actions/CommandAction.ts";
import type { CommandRegistry } from "../Workbench/Services/CommandRegistry.ts";
import { CommandRegistryDIToken } from "../Workbench/Services/CommandRegistry.ts";
import { CompletionController } from "./CompletionController.ts";
import { registerContextKeys } from "../Workbench/Services/ContextKeys.ts";
import type { ContextKeyService } from "../Workbench/Services/ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "../Workbench/Services/ContextKeyService.ts";
import {
    KeybindingsResourceDIToken,
    ServiceAccessorDIToken,
    SettingsResourceDIToken,
    TuiApplicationDIToken,
} from "../Workbench/Services/CoreTokens.ts";
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
import { FindController } from "./FindController.ts";
import type { IController } from "./IController.ts";
import { InputWidgetService, InputWidgetServiceDIToken } from "../Workbench/Services/InputWidgetService.ts";
import type { KeybindingDispatcher } from "../Workbench/Services/KeybindingDispatcher.ts";
import { KeybindingDispatcherDIToken } from "../Workbench/Services/KeybindingDispatcher.ts";
import type { KeybindingRegistry } from "../Workbench/Services/KeybindingRegistry.ts";
import { formatKeybinding, KeybindingRegistryDIToken, parseKeybinding } from "../Workbench/Services/KeybindingRegistry.ts";
import { UserKeybindingsDIToken } from "./Modules/KeybindingsModule.ts";
import { StateServiceDIToken } from "./Modules/StateModule.ts";
import { PanelComponentDIToken } from "../Workbench/Components/Panel/PanelComponent.ts";
import {
    type ProblemsComponent,
    ProblemsComponentDIToken,
    PROBLEMS_VIEW_ID,
} from "../Workbench/Components/Panel/ProblemsComponent.ts";
import { TerminalPanelComponentDIToken } from "../Workbench/Components/Panel/TerminalPanelComponent.ts";
import { DiagnosticsServiceDIToken } from "../Workbench/Services/Diagnostics/DiagnosticsService.ts";
import { type PanelService, PanelServiceDIToken } from "../Workbench/Services/PanelService.ts";
import {
    TERMINAL_VIEW_ID,
    type TerminalService,
    TerminalServiceDIToken,
} from "../Workbench/Services/Terminal/TerminalService.ts";
import { QuickInputComponentDIToken } from "../Workbench/Components/QuickInput/QuickInputComponent.ts";
import type { QuickInputService } from "../Workbench/Services/QuickInputService.ts";
import { QuickInputServiceDIToken } from "../Workbench/Services/QuickInputService.ts";
import { QuickOpenServiceDIToken } from "../Workbench/Services/QuickOpenService.ts";
import { StatusBarComponent, StatusBarComponentDIToken } from "../Workbench/Components/StatusBar/StatusBarComponent.ts";
import { EditorStatusContributionDIToken } from "../Workbench/Services/EditorStatusContribution.ts";
import { TerminalEnvStatusContributionDIToken } from "../Workbench/Services/TerminalEnvironment/TerminalEnvStatusContribution.ts";
import type { TerminalEnvironmentService } from "../Workbench/Services/TerminalEnvironment/TerminalEnvironmentService.ts";
import { TerminalEnvironmentServiceDIToken } from "../Workbench/Services/TerminalEnvironment/TerminalEnvironmentService.ts";
import { WorkbenchStateController } from "./WorkbenchStateController.ts";

export const AppControllerDIToken = token<AppController>("AppController");

const builtinActions = [
    // App
    fileSaveAction,
    newUntitledFileAction,
    fileOpenAction,
    fileOpenFolderAction,

    // Quick Open / пикеры (этап 8: run-обработчики живут в самих экшенах)
    quickOpenAction,
    showCommandsAction,
    gotoLineAction,
    selectThemeAction,
    changeEncodingAction,
    changeEolAction,

    // Cursor movement
    cursorLeftAction,
    cursorLeftSelectAction,
    cursorRightAction,
    cursorRightSelectAction,
    cursorUpAction,
    cursorUpSelectAction,
    cursorDownAction,
    cursorDownSelectAction,
    cursorHomeAction,
    cursorHomeSelectAction,
    cursorEndAction,
    cursorEndSelectAction,
    cursorTopAction,
    cursorTopSelectAction,
    cursorBottomAction,
    cursorBottomSelectAction,
    cursorWordLeftAction,
    cursorWordLeftSelectAction,
    cursorWordRightAction,
    cursorWordRightSelectAction,
    cursorPageDownAction,
    cursorPageDownSelectAction,
    cursorPageUpAction,
    cursorPageUpSelectAction,
    scrollLineUpAction,
    scrollLineDownAction,

    // Editing
    deleteLeftAction,
    deleteRightAction,
    deleteWordLeftAction,
    deleteWordRightAction,
    undoAction,
    redoAction,
    selectAllAction,
    indentLinesAction,
    outdentLinesAction,

    // End of line
    convertToLfAction,
    convertToCrlfAction,
    toggleEolAction,

    // Folding
    foldAction,
    unfoldAction,
    toggleFoldAction,
    foldAllAction,
    unfoldAllAction,
    foldRecursivelyAction,
    unfoldRecursivelyAction,
    ...foldLevelActions,
    gotoNextFoldAction,
    gotoPreviousFoldAction,

    // Whitespace
    trimTrailingWhitespaceAction,
    insertFinalNewLineAction,
    triggerSuggestAction,

    // Clipboard
    clipboardCopyAction,
    clipboardCutAction,
    clipboardPasteAction,

    // Context menu (Shift+F10)
    showEditorContextMenuAction,
    showExplorerContextMenuAction,

    // Explorer file operations (Workbench/Actions поверх Explorer/FileOperations-сервисов)
    fileDeleteAction,
    fileRenameAction,
    refreshExplorerAction,
    fileUndoAction,
    fileRedoAction,
    fileCopyAction,
    fileCutAction,
    filePasteAction,
    fileCopyPathAction,
    fileCopyRelativePathAction,
    explorerNewFileAction,
    explorerNewFolderAction,

    // List
    listFocusPageDownAction,
    listFocusPageUpAction,
    listFocusFirstAction,
    listFocusLastAction,

    // Tabs
    nextEditorInGroupAction,
    previousEditorInGroupAction,
    closeActiveEditorAction,

    // Input widget
    inputCursorLeftAction,
    inputCursorRightAction,
    inputCursorHomeAction,
    inputCursorEndAction,
    inputCursorWordLeftAction,
    inputCursorWordRightAction,
    inputDeleteLeftAction,
    inputDeleteRightAction,
    inputDeleteWordLeftAction,
    inputDeleteWordRightAction,
    inputSelectLeftAction,
    inputSelectRightAction,
    inputSelectToHomeAction,
    inputSelectToEndAction,
    inputSelectWordLeftAction,
    inputSelectWordRightAction,
    inputSelectAllAction,
    inputCopyAction,
    inputCutAction,
    inputPasteAction,
    inputUndoAction,
    inputRedoAction,
];

// Columns added/removed per increase/decrease Side Bar Width command.
const SIDEBAR_WIDTH_STEP = 3;

export class AppController extends Disposable implements IController {
    public static dependencies = [
        EditorServiceDIToken,
        CommandRegistryDIToken,
        KeybindingRegistryDIToken,
        ServiceAccessorDIToken,
        StatusBarComponentDIToken,
        ThemeServiceDIToken,
        ContextKeyServiceDIToken,
        InputWidgetServiceDIToken,
        ILogServiceDIToken,
        TerminalEnvironmentServiceDIToken,
        UserKeybindingsDIToken,
        DialogServiceDIToken,
        LifecycleServiceDIToken,
    ] as const;
    public readonly view: BodyElement;
    public readonly workbenchLayout: WorkbenchLayoutElement;
    private workbenchState: WorkbenchStateController;

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
    private completionController: CompletionController;
    private findController: FindController;
    private statusBarComponent: StatusBarComponent;
    private panelService: PanelService;
    private problemsComponent: ProblemsComponent;
    private terminalService: TerminalService;
    private commands: CommandRegistry;
    private keybindings: KeybindingRegistry;
    private contextKeys: ContextKeyService;
    private inputWidgetService: InputWidgetService;
    private themeService: ThemeService;
    private themeRegistry: ThemeRegistry;
    private menuBar: MenuBarElement | null = null;
    private terminalEnv: TerminalEnvironmentService;
    private dispatcher: KeybindingDispatcher;
    private logger: ILogger;
    /** Resolved path of the active-profile settings.json, or null when unknown (tests/demo). */
    private settingsResource: string | null;
    /** Resolved path of the active-profile keybindings.json, or null when unknown (tests/demo). */
    private keybindingsResource: string | null;

    public constructor(
        editorService: EditorService,
        commands: CommandRegistry,
        keybindings: KeybindingRegistry,
        accessor: ServiceAccessor,
        statusBarComponent: StatusBarComponent,
        themeService: ThemeService,
        contextKeys: ContextKeyService,
        inputWidgetService: InputWidgetService,
        logService: ILogService,
        terminalEnv: TerminalEnvironmentService,
        userKeybindings: readonly IUserKeybindingRule[],
        dialogService: DialogService,
        lifecycleService: LifecycleService,
    ) {
        super();
        this.logger = logService.createLogger("input.keybindings");
        this.terminalEnv = terminalEnv;
        this.dialogService = this.register(dialogService);
        this.lifecycleService = lifecycleService;
        // Несохранённые редакторы участвуют в confirm-save последовательности выхода.
        this.lifecycleService.registerShutdownParticipant(editorService);
        this.themeService = themeService;
        this.themeRegistry = accessor.get(ThemeRegistryDIToken);
        this.editorService = this.register(editorService);
        // Editor-кластер (Workbench, этап 9b): компонент группового контрола
        // (tab strip + контент активного редактора) поверх EditorService.
        this.editorGroupComponent = this.register(accessor.get(EditorGroupComponentDIToken));
        // Explorer-кластер (Workbench): сервис (корень/провайдер/reveal) и компонент
        // (дерево + контекст-меню). AppController владеет их жизнью.
        this.explorerService = this.register(accessor.get(ExplorerServiceDIToken));
        this.explorerComponent = this.register(accessor.get(ExplorerComponentDIToken));
        // Клавиатурный диспатчер (Workbench-сервис): AppController владеет его жизнью
        // и подключает view-хуки (контекстные ключи + модальные оверлеи) — сам сервис
        // про view ничего не знает.
        this.dispatcher = this.register(accessor.get(KeybindingDispatcherDIToken));
        this.dispatcher.updateContextKeys = () => {
            this.updateContextKeys();
        };
        this.dispatcher.hasKeyboardCapturingOverlay = () => this.view.overlayLayer.hasKeyboardCapturingOverlay();
        this.configurationService = accessor.get(IConfigurationServiceDIToken);
        this.settingsResource = accessor.get(SettingsResourceDIToken);
        this.keybindingsResource = accessor.get(KeybindingsResourceDIToken);
        // QuickInput-кластер (Workbench, этап 8): файловый индекс, общий
        // виджет-компонент (host прикрепляется ниже, после постройки view),
        // InputBox/list-pick сервис и Quick Open поверх них. AppController
        // владеет их жизнью.
        this.fileSearchService = this.register(accessor.get(FileSearchServiceDIToken));
        const quickInputComponent = this.register(accessor.get(QuickInputComponentDIToken));
        this.quickInput = accessor.get(QuickInputServiceDIToken);
        this.register(accessor.get(QuickOpenServiceDIToken));
        // Файловые операции (Workbench-сервис): промпт имени/пути — QuickInputService
        // (шов IExplorerInputPrompt замкнут в DI).
        this.fileOperations = accessor.get(FileOperationsServiceDIToken);
        this.completionController = this.register(new CompletionController(this.editorService));
        this.findController = this.register(new FindController(this.editorService, this.editorGroupComponent.view));
        this.findController.applyTheme(themeService.theme);
        this.statusBarComponent = this.register(statusBarComponent);
        // Contribution-сервисы статус-бара: инстанцируем через DI и владеем их жизнью.
        this.register(accessor.get(EditorStatusContributionDIToken));
        this.register(accessor.get(TerminalEnvStatusContributionDIToken));
        // Panel-кластер (Workbench): диагностики (headless), реестр вкладок панели,
        // Problems и терминал. Порядок резолва задаёт порядок табов: PROBLEMS
        // регистрирует ProblemsComponent, TERMINAL — TerminalService.
        this.register(accessor.get(DiagnosticsServiceDIToken));
        this.panelService = accessor.get(PanelServiceDIToken);
        this.problemsComponent = this.register(accessor.get(ProblemsComponentDIToken));
        this.terminalService = this.register(accessor.get(TerminalServiceDIToken));
        const panelComponent = this.register(accessor.get(PanelComponentDIToken));
        this.register(accessor.get(TerminalPanelComponentDIToken));
        this.commands = commands;
        this.keybindings = keybindings;
        this.contextKeys = contextKeys;
        this.inputWidgetService = inputWidgetService;

        // Make custom-mode names (mode_<name>) valid `when` identifiers, then keep context
        // keys in sync when the environment changes (detection finalize / mode toggle);
        // сегмент статус-бара обновляет TerminalEnvStatusContribution по тому же событию.
        registerContextKeys(this.terminalEnv.getKnownModeNames().map((n) => `mode_${n}`));
        this.register(
            this.terminalEnv.onDidChange(() => {
                this.updateContextKeys();
            }),
        );

        this.workbenchLayout = new WorkbenchLayoutElement();
        this.workbenchLayout.setSashHoverColor(themeService.theme.getRequiredColor("sash.hoverBorder"));
        this.workbenchLayout.setCenterContent(this.editorGroupComponent.view);
        this.workbenchLayout.setBottomPanel(panelComponent.view);
        // Видимость панели живёт в PanelService; layout и контекст-ключ следуют за ней.
        this.register(
            this.panelService.onDidChangeVisibility((visible) => {
                this.workbenchLayout.setBottomPanelVisible(visible);
                this.workbenchLayout.markDirty();
                this.contextKeys.set("panelVisible", visible);
            }),
        );

        // Персистентность workbench-состояния (открытые файлы + layout). Координатор
        // читает/пишет layout-элемент и группу редакторов; сам элемент про него не
        // знает — write-through идёт через onDidChangeLayout (drag сэша + команды).
        this.workbenchState = this.register(
            new WorkbenchStateController(accessor.get(StateServiceDIToken), this.editorService, this.workbenchLayout),
        );
        this.workbenchLayout.onDidChangeLayout = () => {
            this.workbenchState.captureLayout();
        };
        this.register(
            this.editorService.onActiveEditorChanged(() => {
                this.workbenchState.captureOpenEditors();
            }),
        );

        this.view = new BodyElement();
        this.dialogService.attachHost(this.view);
        // Контекст-меню дерева Explorer'а открывается в overlay-слое корневой view.
        this.explorerComponent.attachHost(this.view);
        this.view.setContent(this.workbenchLayout);
        this.view.setStatusBar(this.statusBarComponent.view);

        // Общий виджет QuickInput/QuickOpen живёт в overlay-слое корневой view.
        quickInputComponent.attachHost(this.view);
        this.completionController.setHostView(this.view);
        this.completionController.onExecuteCommand = (id, ...args) => {
            this.commands.execute(id, ...args);
        };
        this.findController.setHostView();
        // Find and completion operate on the active editor only — close them when it changes.
        this.register(
            this.editorService.onActiveEditorChanged(() => {
                this.findController.close();
                this.completionController.close();
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
                this.updateContextKeys();
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
        this.register(
            commands.register(
                "workbench.action.showAboutDialog",
                () => {
                    this.showAboutDialog();
                },
                "About",
            ),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...openSettingsAction,
                run: () => {
                    this.openUserConfigFile(this.settingsResource, "settings");
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...openKeybindingsAction,
                run: () => {
                    this.openUserConfigFile(this.keybindingsResource, "keybindings");
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileSaveAsAction,
                run: () => {
                    void this.runSaveAs();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...findAction,
                run: () => {
                    this.findController.open();
                },
            }),
        );
        // triggerSuggestAction registers the ctrl+space keybinding + placeholder in
        // the builtinActions loop; override just the command handler here (Map.set
        // replaces it) so the keybinding is not registered twice.
        this.register(
            commands.register(
                "editor.action.triggerSuggest",
                () => {
                    void this.completionController.trigger();
                },
                "Trigger Suggest",
            ),
        );
        // fileSaveAction registers the ctrl+s keybinding + placeholder in the
        // builtinActions loop; override just the command handler here (Map.set
        // replaces it) so the keybinding is not registered twice. The override
        // routes through a conflict-aware flow that can pop the overwrite dialog.
        this.register(
            commands.register(
                "workbench.action.files.save",
                () => {
                    void this.runSave();
                },
                "File: Save",
            ),
        );
        // newUntitledFileAction registers the ctrl+n keybinding + placeholder in the
        // builtinActions loop; override just the command handler here (needs the group).
        this.register(
            commands.register(
                "workbench.action.files.newUntitledFile",
                () => {
                    this.editorService.newUntitled();
                    this.updateContextKeys();
                },
                "File: New Untitled File",
            ),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...nextMatchAction,
                run: () => {
                    this.findController.next();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...previousMatchAction,
                run: () => {
                    this.findController.prev();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...closeFindWidgetAction,
                run: () => {
                    this.findController.close();
                },
            }),
        );
        // Suggest widget navigation/accept/dismiss. Registered here (after the
        // builtinActions loop) so the suggestWidgetVisible bindings win over the
        // editor's cursorDown/indentLines while the popup is open.
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...selectNextSuggestionAction,
                run: () => {
                    this.completionController.selectNext();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...selectPrevSuggestionAction,
                run: () => {
                    this.completionController.selectPrevious();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...selectNextPageSuggestionAction,
                run: () => {
                    this.completionController.selectNextPage();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...selectPrevPageSuggestionAction,
                run: () => {
                    this.completionController.selectPreviousPage();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...acceptSelectedSuggestionAction,
                run: () => {
                    this.completionController.acceptSelected();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...hideSuggestWidgetAction,
                run: () => {
                    this.completionController.hide();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "workbench.action.toggleSidebarVisibility",
                title: "View: Toggle Primary Side Bar Visibility",
                keybinding: parseKeybinding("ctrl+b"),
                run: () => {
                    const visible = this.workbenchLayout.getLeftPanelVisible();
                    this.workbenchLayout.setLeftPanelVisible(!visible);
                    this.workbenchLayout.markDirty();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "workbench.view.explorer",
                title: "View: Show Explorer",
                keybinding: parseKeybinding("ctrl+shift+e"),
                run: () => {
                    this.workbenchLayout.setLeftPanelVisible(true);
                    this.workbenchLayout.markDirty();
                    this.explorerService.focus();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "workbench.files.action.showActiveFileInExplorer",
                title: "File: Reveal Active File in Explorer",
                run: () => {
                    const filePath = this.editorService.getActiveEditor()?.absoluteFilePath;
                    if (!filePath) return;
                    this.workbenchLayout.setLeftPanelVisible(true);
                    this.workbenchLayout.markDirty();
                    this.explorerService.focus();
                    void this.explorerService.revealPath(filePath);
                },
            }),
        );
        // Side bar width: palette-only, no default keybindings (matching VS Code's
        // increase/decreaseViewWidth). Users can bind them via keybindings.json.
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "workbench.action.increaseSidebarWidth",
                title: "View: Increase Side Bar Width",
                run: () => {
                    this.workbenchLayout.nudgeLeftPanelWidth(SIDEBAR_WIDTH_STEP);
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "workbench.action.decreaseSidebarWidth",
                title: "View: Decrease Side Bar Width",
                run: () => {
                    this.workbenchLayout.nudgeLeftPanelWidth(-SIDEBAR_WIDTH_STEP);
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "workbench.action.resetSidebarWidth",
                title: "View: Reset Side Bar Width",
                run: () => {
                    this.workbenchLayout.resetLeftPanelWidth();
                },
            }),
        );
        // Bottom Panel (Problems/Output/…) visibility.
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "workbench.action.togglePanel",
                title: "View: Toggle Panel Visibility",
                keybinding: parseKeybinding("ctrl+j"),
                run: () => {
                    this.setPanelVisible(!this.workbenchLayout.getBottomPanelVisible());
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "workbench.actions.view.problems",
                title: "View: Toggle Problems (Errors, Warnings, Infos)",
                keybinding: parseKeybinding("ctrl+shift+m"),
                run: () => {
                    // Toggle like VS Code: show + focus Problems, or hide the panel if
                    // Problems is already the visible view.
                    const showing =
                        this.workbenchLayout.getBottomPanelVisible() &&
                        this.panelService.getActiveViewId() === PROBLEMS_VIEW_ID;
                    if (showing) {
                        this.setPanelVisible(false);
                    } else {
                        this.panelService.setActiveView(PROBLEMS_VIEW_ID);
                        this.setPanelVisible(true);
                        this.problemsComponent.focus();
                    }
                },
            }),
        );
        // Integrated Terminal. Только tier csi-u/kitty умеет однозначно кодировать
        // Ctrl+` (в legacy это NUL = Ctrl+Space), поэтому legacy-бинда нет.
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "workbench.action.terminal.toggleTerminal",
                title: "Terminal: Toggle Terminal",
                keybinding: { keys: parseKeybinding("ctrl+`"), when: "tier == 'kitty' || tier == 'csi-u'" },
                run: () => {
                    // Toggle like VS Code: hide the panel if Terminal is already the
                    // visible view, otherwise show + spawn/focus a terminal.
                    const showing =
                        this.workbenchLayout.getBottomPanelVisible() &&
                        this.panelService.getActiveViewId() === TERMINAL_VIEW_ID;
                    if (showing) {
                        this.setPanelVisible(false);
                    } else {
                        this.panelService.setActiveView(TERMINAL_VIEW_ID);
                        this.setPanelVisible(true);
                        this.terminalService.openTerminal();
                        this.updateContextKeys();
                    }
                },
            }),
        );
        // С зажатым Shift Kitty может слать shifted codepoint (`~`) вместо базового `` ` `` —
        // зависит от терминала, поэтому регистрируем обе формы: Ctrl+Shift+` и Ctrl+Shift+~.
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "workbench.action.terminal.new",
                title: "Terminal: Create New Terminal",
                keybindings: [
                    { keys: parseKeybinding("ctrl+shift+`"), when: "tier == 'kitty' || tier == 'csi-u'" },
                    { keys: parseKeybinding("ctrl+shift+~"), when: "tier == 'kitty' || tier == 'csi-u'" },
                ],
                run: () => {
                    this.panelService.setActiveView(TERMINAL_VIEW_ID);
                    this.setPanelVisible(true);
                    this.terminalService.newTerminal();
                    this.updateContextKeys();
                },
            }),
        );

        // Apply user keybindings AFTER all defaults so they take precedence (the registry
        // resolves the last-registered matching binding) and so `-command` unbinds can remove defaults.
        this.dispatcher.applyUserKeybindings(userKeybindings);

        this.setupMenu();
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
        // лишь вешает его листенеры на корневое дерево, которым владеет.
        this.view.addEventListener("keydown", this.dispatcher.handleKeyDownCapture, { capture: true });
        this.view.addEventListener("keypress", this.dispatcher.handleKeyPressCapture, { capture: true });
        this.view.addEventListener("keydown", this.dispatcher.handleKeyDown);
        this.view.addEventListener("keyup", this.dispatcher.handleKeyUp);
        this.view.addEventListener("focus", this.handleFocusChange, { capture: true });
        this.view.addEventListener("blur", this.handleFocusChange, { capture: true });
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
        this.workbenchState.restoreLayout();
        // restoreLayout пишет видимость панели прямо в layout-элемент — синхронизируем
        // истину PanelService (иначе первый toggle после рестора отработал бы вхолостую).
        this.panelService.setVisible(this.workbenchLayout.getBottomPanelVisible());
    }

    public async activate(): Promise<void> {
        // Terminal tier/modes are already detected synchronously (env vars) in the env
        // service constructor, so context keys are correct from the first keypress —
        // push them now. Then kick off the fire-and-forget keyboard-protocol probe; if it
        // confirms richer support it upgrades the tier via onDidChange. Nothing blocks here.
        this.updateContextKeys();
        this.terminalEnv.detect();
        await this.editorService.activate();
        await this.explorerService.refresh();
    }

    public openFile(filePath: string): void {
        this.editorService.openFile(filePath);
        this.updateContextKeys();
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
        this.updateContextKeys();
    }

    /**
     * Opens a user-config file (settings.json / keybindings.json) as an editor tab.
     * The path is resolved at bootstrap; it is null in tests/demo where no user data
     * dir is wired — then this is a no-op. On a fresh install the file may not exist
     * yet: we seed it (create the parent dir + a minimal skeleton) so the editor opens
     * a real file and a subsequent Ctrl+S can't fail with ENOENT, mirroring VS Code.
     */
    private openUserConfigFile(resource: string | null, kind: "settings" | "keybindings"): void {
        if (resource === null) return;
        if (!fs.existsSync(resource)) {
            const skeleton = kind === "settings" ? "{}\n" : "[]\n";
            fs.mkdirSync(path.dirname(resource), { recursive: true });
            fs.writeFileSync(resource, skeleton, "utf-8");
        }
        this.openFile(resource);
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
        this.findController.applyTheme(theme);
        this.menuBar?.setStyles(getMenuStyles(theme));
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

    private handleFocusChange = (_event: TUIFocusEvent): void => {
        this.dispatcher.cancelPendingChord();
        this.updateContextKeys();
        // Фокус ушёл с редактора (клавиатурный путь: Ctrl+Tab, Quick Open) —
        // закрываем suggest-попап (клик-фокус уже покрыт close-on-outside).
        const active = this.view.focusManager?.activeElement ?? null;
        this.completionController.onFocusChanged(active instanceof EditorElement);
    };

    /**
     * Shows/hides the bottom Panel. Истина видимости — {@link PanelService};
     * layout и контекст-ключ `panelVisible` следуют за ней через подписку
     * `onDidChangeVisibility` (см. конструктор).
     */
    private setPanelVisible(visible: boolean): void {
        this.panelService.setVisible(visible);
    }

    private updateContextKeys(): void {
        const active = this.view.focusManager?.activeElement ?? null;
        const editorCount = this.editorService.editorCount;

        this.contextKeys.set("textInputFocus", active instanceof EditorElement);
        this.contextKeys.set("inputWidgetFocus", active instanceof InputElement);
        this.contextKeys.set("listFocus", active instanceof TreeViewElement);
        this.inputWidgetService.setActive(active instanceof InputElement ? active : null);
        this.contextKeys.set("editorGroupHasEditors", editorCount > 0);
        this.contextKeys.set("editorTabsMultiple", editorCount > 1);
        this.contextKeys.set("panelVisible", this.workbenchLayout.getBottomPanelVisible());
        this.contextKeys.set("findWidgetVisible", this.findController.isVisible());
        this.contextKeys.set("suggestWidgetVisible", this.completionController.isOpen());
        this.contextKeys.set("terminalFocus", active instanceof TerminalViewElement);
        this.contextKeys.set("terminalIsOpen", this.terminalService.hasOpenTerminals);

        // Terminal environment (tier / capabilities / modes / OS) — mostly static per session,
        // but mode can be force-toggled at runtime, so refresh alongside focus context.
        const env = this.terminalEnv;
        this.contextKeys.set("tier", env.tier);
        this.contextKeys.set("os", env.os);
        this.contextKeys.set("isMac", env.os === "mac");
        this.contextKeys.set("isLinux", env.os === "linux");
        this.contextKeys.set("isWindows", env.os === "windows");
        this.contextKeys.set("cap_extendedKeys", env.hasCapability("extended-keys"));
        this.contextKeys.set("cap_osc52", env.hasCapability("osc52"));
        this.contextKeys.set("cap_truecolor", env.hasCapability("truecolor"));
        this.contextKeys.set("cap_kittyGraphics", env.hasCapability("kitty-graphics"));
        this.contextKeys.set("cap_mouseSgr", env.hasCapability("mouse-sgr"));
        for (const name of env.getKnownModeNames()) {
            this.contextKeys.setRaw(`mode_${name}`, env.isModeActive(name));
        }
    }

    private setupMenu(): void {
        // Build a menu item from an existing command id. The displayed shortcut is
        // resolved from the keybinding registry (same source as the command palette),
        // so menu labels never drift from the real bindings.
        const item = (label: string, commandId: string): MenuItemEntry => {
            const chord = this.keybindings.getKeybindingForCommand(commandId, this.contextKeys);
            return {
                label,
                shortcut: chord ? formatKeybinding(chord) : undefined,
                onSelect: () => {
                    this.commands.execute(commandId);
                },
            };
        };
        const sep = (): MenuEntry => ({ type: "separator" });

        const menuItems: MenuBarItem[] = [
            {
                label: "File",
                mnemonic: "f",
                entries: [
                    item("New Untitled File", "workbench.action.files.newUntitledFile"),
                    item("New File...", "explorer.newFile"),
                    item("New Folder...", "explorer.newFolder"),
                    sep(),
                    item("Open File...", "workbench.action.files.openFile"),
                    item("Open Folder...", "workbench.action.files.openFolder"),
                    sep(),
                    item("Save", "workbench.action.files.save"),
                    item("Save As...", "workbench.action.files.saveAs"),
                    sep(),
                    item("Settings", "workbench.action.openSettings"),
                    item("Keyboard Shortcuts", "workbench.action.openGlobalKeybindings"),
                    sep(),
                    item("Exit", "workbench.action.quit"),
                ],
            },
            {
                label: "Edit",
                mnemonic: "e",
                entries: [
                    item("Undo", "undo"),
                    item("Redo", "redo"),
                    sep(),
                    item("Cut", "editor.action.clipboardCutAction"),
                    item("Copy", "editor.action.clipboardCopyAction"),
                    item("Paste", "editor.action.clipboardPasteAction"),
                    sep(),
                    item("Find", "actions.find"),
                    item("Find Next", "editor.action.nextMatchFindAction"),
                    item("Find Previous", "editor.action.previousMatchFindAction"),
                ],
            },
            {
                label: "Selection",
                mnemonic: "s",
                entries: [
                    item("Select All", "editor.action.selectAll"),
                    sep(),
                    item("Expand Selection (Word)", "cursorWordRightSelect"),
                ],
            },
            {
                label: "View",
                mnemonic: "v",
                entries: [
                    item("Command Palette...", "workbench.action.showCommands"),
                    sep(),
                    item("Color Theme", "workbench.action.selectTheme"),
                    sep(),
                    item("Explorer", "workbench.view.explorer"),
                    item("Problems", "workbench.actions.view.problems"),
                    item("Terminal", "workbench.action.terminal.toggleTerminal"),
                    item("Toggle Primary Side Bar", "workbench.action.toggleSidebarVisibility"),
                    item("Toggle Panel", "workbench.action.togglePanel"),
                    sep(),
                    item("Increase Side Bar Width", "workbench.action.increaseSidebarWidth"),
                    item("Decrease Side Bar Width", "workbench.action.decreaseSidebarWidth"),
                    item("Reset Side Bar Width", "workbench.action.resetSidebarWidth"),
                ],
            },
            {
                label: "Go",
                mnemonic: "g",
                entries: [
                    item("Go to File...", "workbench.action.quickOpen"),
                    item("Go to Line/Column...", "workbench.action.gotoLine"),
                    sep(),
                    item("Next Editor", "workbench.action.nextEditorInGroup"),
                    item("Previous Editor", "workbench.action.previousEditorInGroup"),
                    sep(),
                    item("Close Editor", "workbench.action.closeActiveEditor"),
                ],
            },
            {
                label: "Help",
                mnemonic: "h",
                entries: [item("About", "workbench.action.showAboutDialog")],
            },
        ];

        const menuBar = new MenuBarElement(menuItems);
        menuBar.setStyles(getMenuStyles(this.themeService.theme));
        this.menuBar = menuBar;
        this.view.setMenuBar(menuBar);
    }

    public showConfirmSaveDialog(
        filename: string,
        callbacks: { onSave: () => void; onDontSave: () => void; onCancel: () => void },
    ): void {
        this.dialogService.showConfirmSaveDialog(filename, callbacks);
    }

    private showConfirmDialog(
        options: ConfirmDialogOptions,
        callbacks: { onConfirm: () => void; onCancel?: () => void },
    ): void {
        this.dialogService.showConfirmDialog(options, callbacks);
    }

    /**
     * Explicit Save (Ctrl+S / menu). Saves the active editor; if the file was
     * modified on disk by another process since it was opened, the write is
     * blocked (to avoid clobbering the parallel changes) and an Overwrite/Cancel
     * dialog is shown instead — mirroring VS Code's dirty-write protection.
     */
    private async runSave(): Promise<void> {
        const editor = this.editorService.getActiveEditor();
        if (editor === null) return;
        const outcome = await editor.save();
        if (outcome === "no-file") {
            // Безымянный буфер (Ctrl+N) — пути ещё нет, уводим в Save As.
            await this.runSaveAs();
            return;
        }
        if (outcome === "conflict") {
            const name = this.editorService.displayName(editor);
            this.showConfirmDialog(
                {
                    title: "Overwrite",
                    message: [
                        `The file "${name}" has been changed on disk.`,
                        "Do you want to overwrite the version on disk with your changes?",
                    ],
                    confirmLabel: "Overwrite",
                    cancelLabel: "Cancel",
                    defaultButton: "cancel",
                },
                {
                    onConfirm: () => {
                        void editor.save({ overwrite: true });
                    },
                },
            );
            return;
        }
    }

    /**
     * Save As flow: prompt for a target path (InputBox), confirm overwrite if a
     * different file already exists, then write via {@link TextFileModel.saveAs}.
     */
    private async runSaveAs(): Promise<void> {
        const editor = this.editorService.getActiveEditor();
        if (!editor) return;

        // Безымянный буфер (Ctrl+N) не имеет пути — стартуем от cwd и предложенного
        // имени (`Untitled-3.txt`: метка буфера + расширение его языка).
        const seed =
            editor.uri.scheme === "file"
                ? editor.uri.fsPath
                : path.join(process.cwd(), this.editorService.suggestedSaveName(editor));
        const target = await this.quickInput.input({
            title: "Save As",
            placeholder: "Enter path to save",
            value: seed,
            validateInput: (value) => {
                const trimmed = value.trim();
                if (trimmed === "") return "Please enter a file name";
                const resolved = path.resolve(trimmed);
                const dir = path.dirname(resolved);
                if (!fs.existsSync(dir)) return `Directory does not exist: ${dir}`;
                if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
                    return "A folder with that name already exists";
                }
                return null;
            },
        });
        if (target === undefined) return;

        const resolved = path.resolve(target.trim());
        const doSave = async (): Promise<void> => {
            try {
                await editor.saveAs(resolved);
                this.updateContextKeys();
            } catch (error) {
                /* v8 ignore start -- defensive: surfaces a filesystem write failure (permissions/disk); not reproducible in tests */
                this.logger.error("Save As failed", { path: resolved, error: String(error) });
                /* v8 ignore stop */
            }
        };

        // Overwriting a *different* existing file → confirm first. Сравниваем ресурсы,
        // а не сырые строки: `resolved` уже абсолютный, но канонизацию даёт Uri.
        if (Uri.file(resolved).toString() !== editor.uri.toString() && fs.existsSync(resolved)) {
            this.showConfirmDialog(
                {
                    title: "Save As",
                    message: `${path.basename(resolved)} already exists. Overwrite?`,
                    confirmLabel: "Overwrite",
                    cancelLabel: "Cancel",
                },
                { onConfirm: () => void doSave() },
            );
            return;
        }
        void doSave();
    }

    public showAboutDialog(): void {
        this.dialogService.showAboutDialog();
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
