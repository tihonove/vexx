import * as fs from "node:fs";
import * as path from "node:path";

import type { ServiceAccessor } from "../../platform/instantiation/common/instantiation.ts";
import { token } from "../../platform/instantiation/common/instantiation.ts";
import { Disposable } from "../../base/common/lifecycle.ts";
import type { IFileClipboard } from "../../platform/clipboard/common/fileClipboard.ts";
import type { ILogger } from "../../platform/log/common/logger.ts";
import type { ILogService } from "../../platform/log/common/log.ts";
import { ILogServiceDIToken } from "../../platform/log/common/logDIToken.ts";
import type { IConfigurationService } from "../../platform/configuration/common/configuration.ts";
import { IConfigurationServiceDIToken } from "../../platform/configuration/common/configurationDIToken.ts";
import type { IUserKeybindingRule } from "../../platform/keybinding/node/keybindingsService.ts";
import { EditorElement } from "../../editor/tui/editorElement.ts";
import type { ThemeRegistry } from "../services/themes/common/themeRegistry.ts";
import type { ThemeService } from "../services/themes/common/themeService.ts";
import { ThemeRegistryDIToken, ThemeServiceDIToken } from "../services/themes/common/themeTokens.ts";
import type { WorkbenchTheme } from "../services/themes/common/workbenchTheme.ts";
import type { TUIFocusEvent } from "../../base/tui/events/tuiFocusEvent.ts";
import type { TUIElement } from "../../base/tui/tuiElement.ts";
import type { ConfirmDialogOptions } from "../../base/tui/ui/dialog/confirmDialogElement.tsx";
import { DialogService } from "../services/dialogs/tui/dialogService.ts";
import { WorkbenchContextKeys } from "./contextkeys.ts";
import { BodyElement } from "../../base/tui/bodyElement.ts";
import { MenuBarElement } from "../../base/tui/ui/menu/menuBarElement.ts";
import type { OverlaySessionHandle } from "../../base/tui/ui/contextview/overlayLayer.ts";
import { WorkbenchLayoutElement } from "./layout.ts";

import { quitAction } from "./actions/appActions.ts";
import { clipboardCopyAction, clipboardCutAction, clipboardPasteAction } from "./parts/editor/clipboardActions.ts";
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
} from "../../editor/tui/coreCommands.ts";
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
} from "./parts/editor/editorEditActions.ts";
import { convertToCrlfAction, convertToLfAction, toggleEolAction } from "./parts/editor/eolActions.ts";
import { fileSaveAction, newUntitledFileAction } from "../contrib/files/tui/fileActions.ts";
import { FileCommands } from "../contrib/files/tui/fileCommands.ts";
import { closeFindWidgetAction, findAction, nextMatchAction, previousMatchAction } from "../../editor/contrib/find/tui/findActions.ts";
import {
    acceptSelectedSuggestionAction,
    hideSuggestWidgetAction,
    selectNextPageSuggestionAction,
    selectNextSuggestionAction,
    selectPrevPageSuggestionAction,
    selectPrevSuggestionAction,
} from "../../editor/contrib/suggest/tui/suggestActions.ts";
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
} from "../../editor/contrib/folding/tui/foldingActions.ts";
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
} from "./actions/inputActions.ts";
import {
    listFocusFirstAction,
    listFocusLastAction,
    listFocusPageDownAction,
    listFocusPageUpAction,
} from "./actions/listActions.ts";
import { openKeybindingsAction, openSettingsAction } from "../contrib/preferences/tui/preferencesActions.ts";
import { gotoLineAction, quickOpenAction, showCommandsAction } from "../contrib/quickaccess/tui/quickOpenActions.ts";
import { closeActiveEditorAction, nextEditorInGroupAction, previousEditorInGroupAction } from "./parts/editor/tabActions.ts";
import { selectColorTheme, selectThemeAction } from "../contrib/themes/tui/themeActions.ts";
import {
    insertFinalNewLineAction,
    triggerSuggestAction,
    trimTrailingWhitespaceAction,
} from "./parts/editor/whitespaceActions.ts";
import { registerAction } from "../../platform/commands/common/commandAction.ts";
import { registerLayoutActions } from "./actions/layoutActions.ts";
import { createWorkbenchMenuBar } from "./parts/menubar/menubar.ts";
import type { CommandRegistry } from "../../platform/commands/common/commands.ts";
import { CommandRegistryDIToken } from "../../platform/commands/common/commands.ts";
import { CompletionController } from "../../editor/contrib/suggest/tui/completionController.ts";
import { registerContextKeys } from "../../platform/contextkey/common/contextkeys.ts";
import type { ContextKeyService } from "../../platform/contextkey/common/contextKeyService.ts";
import { ContextKeyServiceDIToken } from "../../platform/contextkey/common/contextKeyService.ts";
import {
    ClipboardDIToken,
    FileClipboardDIToken,
    KeybindingsResourceDIToken,
    ServiceAccessorDIToken,
    SettingsResourceDIToken,
    TuiApplicationDIToken,
} from "./coreTokens.ts";
import { DiagnosticsController, DiagnosticsControllerDIToken } from "../contrib/markers/tui/diagnosticsController.ts";
import { EditorGroupControllerDIToken } from "./parts/editor/editorGroupController.ts";
import { EditorGroupController } from "./parts/editor/editorGroupController.ts";
import { FileSearchService } from "../services/search/node/fileSearchService.ts";
import { FileTreeController } from "../contrib/files/tui/fileTreeController.ts";
import { FindController } from "../../editor/contrib/find/tui/findController.ts";
import type { IController } from "../common/controller.ts";
import { InputWidgetController, InputWidgetControllerDIToken } from "../contrib/files/tui/inputWidgetController.ts";
import type { KeybindingRegistry } from "../../platform/keybinding/common/keybindingsRegistry.ts";
import { KeybindingRegistryDIToken, parseKeybinding } from "../../platform/keybinding/common/keybindingsRegistry.ts";
import { ModifierReleaseArmoryDIToken } from "../../platform/keybinding/common/modifierReleaseArmory.ts";
import { KeybindingDispatcher } from "../services/keybinding/tui/keybindingDispatcher.ts";
import { UserKeybindingsDIToken } from "../../vexx/modules/keybindingsModule.ts";
import { StateServiceDIToken } from "../../vexx/modules/stateModule.ts";
import { PanelController, PanelControllerDIToken } from "./parts/panel/panelController.ts";
import { ProblemsController, ProblemsControllerDIToken } from "../contrib/markers/tui/problemsController.ts";
import { QuickInputController } from "../../platform/quickinput/tui/quickInputController.ts";
import { QuickOpenController } from "../contrib/quickaccess/tui/quickOpenController.ts";
import { StatusBarControllerDIToken } from "./parts/statusbar/statusBarController.ts";
import { StatusBarController } from "./parts/statusbar/statusBarController.ts";
import type { TerminalEnvironmentService } from "../terminalEnvironment/terminalEnvironmentService.ts";
import { TerminalEnvironmentServiceDIToken } from "../terminalEnvironment/terminalEnvironmentService.ts";
import { UndoRedoService, UndoRedoServiceDIToken } from "../../platform/undoRedo/common/undoRedoService.ts";
import { WorkspaceEditService, WorkspaceEditServiceDIToken } from "../contrib/bulkEdit/node/workspaceEditService.ts";
import { WorkbenchStateController } from "./workbenchStateController.ts";

export const AppControllerDIToken = token<AppController>("AppController");

const builtinActions = [
    // App
    fileSaveAction,
    newUntitledFileAction,

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

export class AppController extends Disposable implements IController {
    public static dependencies = [
        EditorGroupControllerDIToken,
        CommandRegistryDIToken,
        KeybindingRegistryDIToken,
        ServiceAccessorDIToken,
        StatusBarControllerDIToken,
        ThemeServiceDIToken,
        ContextKeyServiceDIToken,
        InputWidgetControllerDIToken,
        ILogServiceDIToken,
        TerminalEnvironmentServiceDIToken,
        UserKeybindingsDIToken,
    ] as const;
    public readonly view: BodyElement;
    public readonly workbenchLayout: WorkbenchLayoutElement;
    private workbenchState: WorkbenchStateController;

    private editorGroupController: EditorGroupController;
    private dialogs: DialogService;
    private fileCommands: FileCommands;
    private workbenchContextKeys: WorkbenchContextKeys;
    private fileTreeContextMenuSession: OverlaySessionHandle | null = null;
    private fileTreeController: FileTreeController;
    private fileClipboard: IFileClipboard;
    private workspaceEditService: WorkspaceEditService;
    private undoRedoService: UndoRedoService;
    private configurationService: IConfigurationService;
    private fileSearchService: FileSearchService;
    private quickOpenController: QuickOpenController;
    private quickInputController: QuickInputController;
    private completionController: CompletionController;
    private findController: FindController;
    private statusBarController: StatusBarController;
    private diagnosticsController: DiagnosticsController;
    private panelController: PanelController;
    private problemsController: ProblemsController;
    private commands: CommandRegistry;
    private keybindings: KeybindingRegistry;
    private contextKeys: ContextKeyService;
    private inputWidgetController: InputWidgetController;
    private themeService: ThemeService;
    private themeRegistry: ThemeRegistry;
    private menuBar: MenuBarElement | null = null;
    private terminalEnv: TerminalEnvironmentService;
    private keybindingDispatcher: KeybindingDispatcher;
    private logger: ILogger;
    /** Resolved path of the active-profile settings.json, or null when unknown (tests/demo). */
    private settingsResource: string | null;
    /** Resolved path of the active-profile keybindings.json, or null when unknown (tests/demo). */
    private keybindingsResource: string | null;

    public constructor(
        editorGroupController: EditorGroupController,
        commands: CommandRegistry,
        keybindings: KeybindingRegistry,
        accessor: ServiceAccessor,
        statusBarController: StatusBarController,
        themeService: ThemeService,
        contextKeys: ContextKeyService,
        inputWidgetController: InputWidgetController,
        logService: ILogService,
        terminalEnv: TerminalEnvironmentService,
        userKeybindings: readonly IUserKeybindingRule[],
    ) {
        super();
        this.logger = logService.createLogger("input.keybindings");
        this.terminalEnv = terminalEnv;
        this.themeService = themeService;
        this.themeRegistry = accessor.get(ThemeRegistryDIToken);
        this.editorGroupController = this.register(editorGroupController);
        this.fileTreeController = this.register(new FileTreeController(themeService));
        // Ошибка файлового watcher'а больше не роняет процесс (см. FileTreeDataProvider):
        // ловим её здесь и пишем в лог. ENOSPC/EMFILE — исчерпан лимит inotify; даём
        // самодокументирующуюся подсказку, как в уведомлении VS Code.
        const watcherLogger = logService.createLogger("filetree.watcher");
        this.fileTreeController.onWatchError = (dirPath, error) => {
            const code = (error as NodeJS.ErrnoException).code;
            const hint =
                code === "ENOSPC" || code === "EMFILE"
                    ? " — inotify watch limit reached; increase fs.inotify.max_user_watches"
                    : "";
            watcherLogger.warn(`file watcher error${hint}`, { dirPath, code, error: String(error) });
        };
        this.keybindingDispatcher = this.register(
            new KeybindingDispatcher({
                keybindings,
                commands,
                contextKeys,
                armory: accessor.get(ModifierReleaseArmoryDIToken),
                terminalEnv,
                logger: this.logger,
                setChordHint: (hint) => {
                    this.statusBarController.setChordHint(hint);
                },
                onBeforeDispatch: () => {
                    this.updateContextKeys();
                },
            }),
        );
        this.fileClipboard = accessor.get(FileClipboardDIToken);
        this.workspaceEditService = accessor.get(WorkspaceEditServiceDIToken);
        this.undoRedoService = accessor.get(UndoRedoServiceDIToken);
        this.configurationService = accessor.get(IConfigurationServiceDIToken);
        this.settingsResource = accessor.get(SettingsResourceDIToken);
        this.keybindingsResource = accessor.get(KeybindingsResourceDIToken);
        // Подсветка «вырезанных» файлов в дереве следует за состоянием буфера.
        this.register(
            this.fileClipboard.onDidChange((entry) => {
                this.fileTreeController.setCutPaths(entry?.mode === "cut" ? entry.paths : []);
            }),
        );
        this.fileSearchService = this.register(new FileSearchService());
        this.quickOpenController = this.register(
            new QuickOpenController(this.fileSearchService, commands, keybindings, contextKeys),
        );
        this.quickInputController = this.register(new QuickInputController());
        this.completionController = this.register(new CompletionController(this.editorGroupController));
        this.findController = this.register(new FindController(this.editorGroupController));
        this.findController.applyTheme(themeService.theme);
        this.statusBarController = this.register(statusBarController);
        this.diagnosticsController = this.register(accessor.get(DiagnosticsControllerDIToken));
        this.panelController = this.register(accessor.get(PanelControllerDIToken));
        this.problemsController = this.register(accessor.get(ProblemsControllerDIToken));
        this.commands = commands;
        this.keybindings = keybindings;
        this.contextKeys = contextKeys;
        this.inputWidgetController = inputWidgetController;

        // Make custom-mode names (mode_<name>) valid `when` identifiers, then keep context
        // keys + status bar in sync when the environment changes (detection finalize / mode toggle).
        registerContextKeys(this.terminalEnv.getKnownModeNames().map((n) => `mode_${n}`));
        this.register(
            this.terminalEnv.onDidChange(() => {
                this.updateContextKeys();
                this.statusBarController.update();
            }),
        );

        this.workbenchLayout = new WorkbenchLayoutElement();
        this.workbenchLayout.setSashHoverColor(themeService.theme.getRequiredColor("sash.hoverBorder"));
        this.workbenchLayout.setCenterContent(this.editorGroupController.view);
        this.workbenchLayout.setBottomPanel(this.panelController.view);

        // Персистентность workbench-состояния (открытые файлы + layout). Координатор
        // читает/пишет layout-элемент и группу редакторов; сам элемент про него не
        // знает — write-through идёт через onDidChangeLayout (drag сэша + команды).
        this.workbenchState = this.register(
            new WorkbenchStateController(accessor.get(StateServiceDIToken), this.editorGroupController, this.workbenchLayout),
        );
        this.workbenchLayout.onDidChangeLayout = () => {
            this.workbenchState.captureLayout();
        };
        this.register(
            this.editorGroupController.onActiveEditorChanged(() => {
                this.workbenchState.captureOpenEditors();
            }),
        );

        this.view = new BodyElement();
        this.view.setContent(this.workbenchLayout);
        this.view.setStatusBar(this.statusBarController.view);
        this.dialogs = new DialogService(this.view, themeService.theme);
        this.workbenchContextKeys = new WorkbenchContextKeys({
            view: this.view,
            contextKeys,
            editorGroup: this.editorGroupController,
            layout: this.workbenchLayout,
            inputWidgetController,
            findController: this.findController,
            completionController: this.completionController,
            terminalEnv,
        });

        this.quickOpenController.setHostView(this.view);
        this.quickInputController.setHostView(this.view);
        this.completionController.setHostView(this.view);
        this.completionController.onExecuteCommand = (id, ...args) => {
            this.commands.execute(id, ...args);
        };
        this.findController.setHostView();
        // Find and completion operate on the active editor only — close them when it changes.
        this.register(
            this.editorGroupController.onActiveEditorChanged(() => {
                this.findController.close();
                this.completionController.close();
                this.fileCommands.autoRevealActiveFile();
            }),
        );
        this.register(
            commands.register("workbench.openFile", (absolutePath: unknown) => {
                this.editorGroupController.openFile(absolutePath as string);
                this.updateContextKeys();
                this.statusBarController.update();
            }),
        );
        this.quickOpenController.onExecuteCommand = (id, ...args) => {
            this.commands.execute(id, ...args);
        };
        // Go-to-Line targets the active editor (read lazily, so a `file:line`
        // accept jumps in the editor opened by the same accept).
        this.quickOpenController.getActiveEditor = () => this.editorGroupController.getActiveEditor();

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
                ...quickOpenAction,
                run: () => {
                    this.quickOpenController.open("files");
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...showCommandsAction,
                run: () => {
                    this.quickOpenController.open("commands");
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...selectThemeAction,
                run: () => {
                    void selectColorTheme({
                        themeService: this.themeService,
                        themeRegistry: this.themeRegistry,
                        quickInput: this.quickInputController,
                        configuration: this.configurationService,
                    });
                },
            }),
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
                ...gotoLineAction,
                run: () => {
                    this.quickOpenController.open("line");
                },
            }),
        );
        // Файловые команды (проводник + save/open-флоу) — vs/workbench/contrib/files.
        // Создаётся ПОСЛЕ builtinActions: FileCommands переопределяет обработчик
        // workbench.action.files.save, зарегистрированный там плейсхолдером.
        this.fileCommands = this.register(
            new FileCommands({
                commands,
                keybindings,
                accessor,
                view: this.view,
                fileTree: this.fileTreeController,
                fileClipboard: this.fileClipboard,
                workspaceEdits: this.workspaceEditService,
                undoRedo: this.undoRedoService,
                configuration: this.configurationService,
                editorGroup: this.editorGroupController,
                quickInput: this.quickInputController,
                dialogs: this.dialogs,
                themeService,
                logger: logService.createLogger("workbench.files"),
                clipboardToken: ClipboardDIToken,
                openFile: (absolutePath) => {
                    this.openFile(absolutePath);
                },
                setWorkspaceFolder: (dirPath) => {
                    this.setWorkspaceFolder(dirPath);
                },
                onDidSave: () => {
                    this.statusBarController.update();
                },
                onDidSaveAs: () => {
                    this.updateContextKeys();
                    this.statusBarController.update();
                },
            }),
        );
        this.fileCommands.onRevealRequested = () => {
            this.workbenchLayout.setLeftPanelVisible(true);
            this.workbenchLayout.markDirty();
        };
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
        // newUntitledFileAction registers the ctrl+n keybinding + placeholder in the
        // builtinActions loop; override just the command handler here (needs the group).
        this.register(
            commands.register(
                "workbench.action.files.newUntitledFile",
                () => {
                    this.editorGroupController.newUntitled();
                    this.updateContextKeys();
                    this.statusBarController.update();
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
        for (const d of registerLayoutActions({
            commands,
            keybindings,
            accessor,
            layout: this.workbenchLayout,
            fileTree: this.fileTreeController,
            panelController: this.panelController,
            problemsController: this.problemsController,
            setPanelVisible: (visible) => {
                this.setPanelVisible(visible);
            },
        })) {
            this.register(d);
        }

        // Apply user keybindings AFTER all defaults so they take precedence (the registry
        // resolves the last-registered matching binding) and so `-command` unbinds can remove defaults.
        this.keybindingDispatcher.applyUserKeybindings(userKeybindings);

        this.setupMenu();
        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );

        this.editorGroupController.onEditorCreate = (editor) => {
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
        // Вся клавиатурная маршрутизация (аккорды, overlay-модальность, keyup-релизы)
        // живёт в KeybindingDispatcher; здесь остаются только app-уровневые подписки.
        this.keybindingDispatcher.mount(this.view);
        this.view.addEventListener("keypress", this.handleKeyPress);
        this.view.addEventListener("focus", this.handleFocusChange, { capture: true });
        this.view.addEventListener("blur", this.handleFocusChange, { capture: true });
        this.editorGroupController.mount();
        this.editorGroupController.onRequestConfirmClose = (index) => {
            const editor = this.editorGroupController.getEditor(index);
            /* v8 ignore start -- defensive: the callback is only invoked synchronously with a valid tab index, so the editor always exists */
            if (!editor) return;
            /* v8 ignore stop */
            /* v8 ignore start -- defensive: editors opened via openFile() always have a file path, so fileName is never null */
            this.showConfirmSaveDialog(editor.fileName ?? "untitled", {
                /* v8 ignore stop */
                onSave: () => {
                    // Explicit "Save" while closing a modified tab: honour the
                    // user's edits even against an external change (overwrite),
                    // so choosing Save never silently drops their work.
                    void editor.save({ overwrite: true }).then(() => {
                        this.editorGroupController.closeTab(index);
                    });
                },
                onDontSave: () => {
                    this.editorGroupController.closeTab(index);
                },
                /* v8 ignore start -- placeholder no-op: cancelling keeps the editor open, nothing to do */
                onCancel: () => {
                    // noop
                },
                /* v8 ignore stop */
            });
        };
        this.fileTreeController.mount();
        this.fileTreeController.onFileActivate = (filePath) => {
            this.editorGroupController.openFile(filePath);
            this.updateContextKeys();
            this.statusBarController.update();
        };
        this.fileTreeController.onFileContextMenu = (node, screenX, screenY) => {
            this.fileCommands.showFileTreeContextMenu(node.path, screenX, screenY);
        };
        this.statusBarController.mount();
        this.diagnosticsController.mount();
        this.panelController.mount();
        this.problemsController.mount();
        // Применяем сохранённый layout до первого кадра (run() идёт после mount()).
        // Workspace-стор уже открыт: setWorkspaceFolder вызывается до mount().
        this.workbenchState.restoreLayout();
    }

    public async activate(): Promise<void> {
        // Terminal tier/modes are already detected synchronously (env vars) in the env
        // service constructor, so context keys are correct from the first keypress —
        // push them now. Then kick off the fire-and-forget keyboard-protocol probe; if it
        // confirms richer support it upgrades the tier via onDidChange. Nothing blocks here.
        this.updateContextKeys();
        this.terminalEnv.detect();
        await this.editorGroupController.activate();
        await this.fileTreeController.activate();
        await this.statusBarController.activate();
        await this.panelController.activate();
    }

    public openFile(filePath: string): void {
        this.editorGroupController.openFile(filePath);
        this.updateContextKeys();
        this.statusBarController.update();
    }

    /**
     * Восстанавливает открытые в прошлой сессии файлы этого воркспейса (реплей
     * сохранённых путей + активная вкладка). Вызывается из `main.ts`, только если
     * пользователь НЕ передал файлы в CLI (явные файлы перебивают сессию).
     */
    public restoreOpenEditors(): void {
        this.workbenchState.restoreOpenEditors();
        this.updateContextKeys();
        this.statusBarController.update();
    }

    /**
     * Прокидывает статус-декорации файлов (цвет имени + буква-бейдж) в дерево файлов.
     * Ключ — абсолютный путь; цвета уже резолвнуты. Поставщики статуса (git) и e2e-демо
     * дёргают это, чтобы подсветить изменённые/новые файлы в explorer.
     */
    public setFileDecorations(entries: readonly { path: string; color?: number; badge?: string }[]): void {
        this.fileTreeController.setFileDecorations(entries);
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
        this.fileTreeController.setRootPath(dirPath);
        this.workbenchLayout.setLeftPanel(this.fileTreeController.view);
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

    /**
     * Дерево файлов. Минимальный DI-шов: `FileTreeController` создаётся внутри
     * AppController, а мосту файловых декораций extension-host'а нужна ссылка на
     * него (см. `FileTreeControllerDIToken` / `ExtensionHostModule`).
     */
    public get fileTree(): FileTreeController {
        return this.fileTreeController;
    }

    public focusEditor(): void {
        this.editorGroupController.focusEditor();
    }

    private applyTheme(theme: WorkbenchTheme): void {
        this.view.style = {
            fg: theme.getRequiredColor("foreground"),
            bg: theme.getRequiredColor("editor.background"),
        };
        this.dialogs.applyTheme(theme);
        this.findController.applyTheme(theme);
        this.menuBar?.applyTheme(theme);
        this.workbenchLayout.setSashHoverColor(theme.getRequiredColor("sash.hoverBorder"));
    }

    private handleKeyPress = (): void => {
        this.statusBarController.update();
    };

    private handleFocusChange = (_event: TUIFocusEvent): void => {
        this.keybindingDispatcher.cancelPendingChord();
        this.updateContextKeys();
        // Фокус ушёл с редактора (клавиатурный путь: Ctrl+Tab, Quick Open) —
        // закрываем suggest-попап (клик-фокус уже покрыт close-on-outside).
        const active = this.view.focusManager?.activeElement ?? null;
        this.completionController.onFocusChanged(active instanceof EditorElement);
    };

    /** Shows/hides the bottom Panel and keeps the `panelVisible` context key in sync. */
    private setPanelVisible(visible: boolean): void {
        this.workbenchLayout.setBottomPanelVisible(visible);
        this.workbenchLayout.markDirty();
        this.contextKeys.set("panelVisible", visible);
    }

    private updateContextKeys(): void {
        this.workbenchContextKeys.update();
    }

    private setupMenu(): void {
        const menuBar = createWorkbenchMenuBar({
            commands: this.commands,
            keybindings: this.keybindings,
            contextKeys: this.contextKeys,
            theme: this.themeService.theme,
        });
        this.menuBar = menuBar;
        this.view.setMenuBar(menuBar);
    }

    public showConfirmSaveDialog(
        filename: string,
        callbacks: { onSave: () => void; onDontSave: () => void; onCancel: () => void },
    ): void {
        this.dialogs.showConfirmSaveDialog(filename, callbacks);
    }

    public showAboutDialog(): void {
        this.dialogs.showAboutDialog();
    }

    private doQuit(accessor: ServiceAccessor): void {
        accessor.get(TuiApplicationDIToken).backend.teardown();
        process.exit(0);
    }

    public requestQuit(accessor: ServiceAccessor): void {
        const modifiedIndices: number[] = [];
        for (let i = 0; i < this.editorGroupController.editorCount; i++) {
            /* v8 ignore start -- defensive: i is always within [0, editorCount), so getEditor() never returns null here */
            if (this.editorGroupController.getEditor(i)?.isModified) {
                /* v8 ignore stop */
                modifiedIndices.push(i);
            }
        }
        if (modifiedIndices.length === 0) {
            this.doQuit(accessor);
        } else {
            this.showQuitConfirmDialogSequential(modifiedIndices, accessor);
        }
    }

    private showQuitConfirmDialogSequential(remainingIndices: number[], accessor: ServiceAccessor): void {
        const [index, ...rest] = remainingIndices;
        const editor = this.editorGroupController.getEditor(index);
        if (!editor) {
            if (rest.length === 0) {
                this.doQuit(accessor);
            } else {
                this.showQuitConfirmDialogSequential(rest, accessor);
            }
            return;
        }
        /* v8 ignore start -- defensive: editors opened via openFile() always have a file path, so fileName is never null */
        this.showConfirmSaveDialog(editor.fileName ?? "untitled", {
            /* v8 ignore stop */
            onSave: () => {
                // Explicit "Save" during quit: overwrite so the user's edits win
                // over an external change (choosing Save must not drop their work).
                void editor.save({ overwrite: true }).then(() => {
                    if (rest.length === 0) {
                        this.doQuit(accessor);
                    } else {
                        this.showQuitConfirmDialogSequential(rest, accessor);
                    }
                });
            },
            onDontSave: () => {
                if (rest.length === 0) {
                    this.doQuit(accessor);
                } else {
                    this.showQuitConfirmDialogSequential(rest, accessor);
                }
            },
            /* v8 ignore start -- placeholder no-op: cancelling keeps the editor open, nothing to do */
            onCancel: () => {
                // noop
            },
            /* v8 ignore stop */
        });
    }
}
