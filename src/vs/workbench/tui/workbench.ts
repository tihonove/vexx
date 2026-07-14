import * as fs from "node:fs";
import * as os from "node:os";
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
import { BodyElement } from "../../base/tui/bodyElement.ts";
import { InputElement } from "../../base/tui/ui/inputbox/inputElement.ts";
import type { MenuBarItem } from "../../base/tui/ui/menu/menuBarElement.ts";
import { MenuBarElement } from "../../base/tui/ui/menu/menuBarElement.ts";
import type { OverlaySessionHandle } from "../../base/tui/ui/contextview/overlayLayer.ts";
import type { MenuEntry, MenuItemEntry } from "../../base/tui/ui/menu/popupMenuElement.ts";
import { PopupMenuElement } from "../../base/tui/ui/menu/popupMenuElement.ts";
import { TreeViewElement } from "../../base/tui/ui/tree/treeViewElement.ts";
import { WorkbenchLayoutElement } from "./workbenchLayoutElement.ts";

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
import {
    fileOpenAction,
    fileOpenFolderAction,
    fileSaveAction,
    fileSaveAsAction,
    newUntitledFileAction,
} from "../contrib/files/tui/fileActions.ts";
import { fileDeleteAction } from "../contrib/files/tui/fileTreeActions.ts";
import {
    buildPasteEdits,
    fileCopyAction,
    fileCopyPathAction,
    fileCopyRelativePathAction,
    fileCutAction,
    filePasteAction,
} from "../contrib/files/tui/fileTreeClipboardActions.ts";
import { explorerNewFileAction, explorerNewFolderAction } from "../contrib/files/tui/fileTreeCreateActions.ts";
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
import { selectThemeAction } from "../contrib/themes/tui/themeActions.ts";
import {
    insertFinalNewLineAction,
    triggerSuggestAction,
    trimTrailingWhitespaceAction,
} from "./parts/editor/whitespaceActions.ts";
import { registerAction } from "../../platform/commands/common/commandAction.ts";
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
import { formatKeybinding, KeybindingRegistryDIToken, parseKeybinding } from "../../platform/keybinding/common/keybindingsRegistry.ts";
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
import { UndoRedoService, UndoRedoServiceDIToken, WORKSPACE_UNDO_CONTEXT } from "../../platform/undoRedo/common/undoRedoService.ts";
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

// Columns added/removed per increase/decrease Side Bar Width command.
const SIDEBAR_WIDTH_STEP = 3;

/** Human-readable base-type label shown next to a theme in the picker. */
export function themeTypeLabel(type: "dark" | "light" | "hc" | "hcLight"): string {
    switch (type) {
        case "light":
            return "light";
        case "hc":
            return "high contrast";
        case "hcLight":
            return "high contrast light";
        default:
            return "dark";
    }
}

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
                this.autoRevealActiveFile();
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
                    void this.selectColorTheme();
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
                ...fileOpenAction,
                run: () => {
                    void this.runOpenFile();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileOpenFolderAction,
                run: () => {
                    void this.runOpenFolder();
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
                    this.editorGroupController.newUntitled();
                    this.updateContextKeys();
                    this.statusBarController.update();
                },
                "File: New Untitled File",
            ),
        );
        this.register(
            commands.register(
                "workbench.files.action.refreshFilesExplorer",
                () => {
                    void this.fileTreeController.refresh();
                },
                "File: Refresh Explorer",
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
                    this.fileTreeController.focus();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "workbench.files.action.showActiveFileInExplorer",
                title: "File: Reveal Active File in Explorer",
                run: () => {
                    const filePath = this.editorGroupController.getActiveEditor()?.absoluteFilePath;
                    if (!filePath) return;
                    this.workbenchLayout.setLeftPanelVisible(true);
                    this.workbenchLayout.markDirty();
                    this.fileTreeController.focus();
                    void this.fileTreeController.revealPath(filePath);
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
                        this.workbenchLayout.getBottomPanelVisible() && this.panelController.isProblemsActive();
                    if (showing) {
                        this.setPanelVisible(false);
                    } else {
                        this.panelController.showProblems();
                        this.setPanelVisible(true);
                        this.problemsController.focus();
                    }
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileDeleteAction,
                run: (_a, ...args) => {
                    const filePath = (args[0] as string | undefined) ?? this.fileTreeController.getSelectedPaths()[0];
                    if (filePath) this.requestDeleteFile(filePath);
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileCopyAction,
                run: () => {
                    const paths = this.fileTreeController.getSelectedPaths();
                    if (paths.length > 0) this.fileClipboard.write(paths, "copy");
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileCutAction,
                run: () => {
                    const paths = this.fileTreeController.getSelectedPaths();
                    if (paths.length > 0) this.fileClipboard.write(paths, "cut");
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...explorerNewFileAction,
                run: (_a, ...args) => {
                    void this.runCreate("file", args[0] as string | undefined);
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...explorerNewFolderAction,
                run: (_a, ...args) => {
                    void this.runCreate("folder", args[0] as string | undefined);
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...filePasteAction,
                run: () => {
                    const targetDir = this.fileTreeController.getPasteTargetDir();
                    if (!targetDir) return;
                    const entry = this.fileClipboard.read();
                    if (!entry) return;
                    this.workspaceEditService.applyFileEdits(
                        buildPasteEdits(entry, targetDir),
                        entry.mode === "cut" ? "Move" : "Paste",
                    );
                    if (entry.mode === "cut") this.fileClipboard.clear();
                    void this.fileTreeController.refresh();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileCopyPathAction,
                run: (runAccessor, ...args) => {
                    const filePath = (args[0] as string | undefined) ?? this.fileTreeController.getSelectedPaths()[0];
                    if (filePath) void runAccessor.get(ClipboardDIToken).writeText(filePath);
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileCopyRelativePathAction,
                run: (runAccessor, ...args) => {
                    const filePath = (args[0] as string | undefined) ?? this.fileTreeController.getSelectedPaths()[0];
                    if (!filePath) return;
                    const root = this.fileTreeController.getRootPath();
                    const relative = root ? path.relative(root, filePath) : filePath;
                    void runAccessor.get(ClipboardDIToken).writeText(relative);
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "fileOperations.undo",
                title: "File: Undo",
                keybinding: parseKeybinding("ctrl+z"),
                when: "listFocus",
                run: () => {
                    this.undoWorkspace();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "fileOperations.redo",
                title: "File: Redo",
                keybindings: [parseKeybinding("ctrl+shift+z"), parseKeybinding("ctrl+y")],
                when: "listFocus",
                run: () => {
                    void this.undoRedoService.redo(WORKSPACE_UNDO_CONTEXT).then((ok) => {
                        if (ok) void this.fileTreeController.refresh();
                    });
                },
            }),
        );

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
            this.showFileTreeContextMenu(node.path, screenX, screenY);
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
        const active = this.view.focusManager?.activeElement ?? null;
        const editorCount = this.editorGroupController.editorCount;

        this.contextKeys.set("textInputFocus", active instanceof EditorElement);
        this.contextKeys.set("inputWidgetFocus", active instanceof InputElement);
        this.contextKeys.set("listFocus", active instanceof TreeViewElement);
        this.inputWidgetController.setActive(active instanceof InputElement ? active : null);
        this.contextKeys.set("editorGroupHasEditors", editorCount > 0);
        this.contextKeys.set("editorTabsMultiple", editorCount > 1);
        this.contextKeys.set("panelVisible", this.workbenchLayout.getBottomPanelVisible());
        this.contextKeys.set("findWidgetVisible", this.findController.isVisible());
        this.contextKeys.set("suggestWidgetVisible", this.completionController.isOpen());

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
        menuBar.applyTheme(this.themeService.theme);
        this.menuBar = menuBar;
        this.view.setMenuBar(menuBar);
    }

    public showConfirmSaveDialog(
        filename: string,
        callbacks: { onSave: () => void; onDontSave: () => void; onCancel: () => void },
    ): void {
        this.dialogs.showConfirmSaveDialog(filename, callbacks);
    }

    /**
     * Автоматически подсвечивает активный файл в дереве при смене активного редактора,
     * если включена настройка `explorer.autoReveal`. Фокус не отбирается у редактора —
     * меняется только выделение/скролл дерева (в отличие от явной команды reveal).
     */
    private autoRevealActiveFile(): void {
        const autoReveal = this.configurationService.get<boolean>("explorer.autoReveal", true) ?? true;
        if (!autoReveal) return;
        const filePath = this.editorGroupController.getActiveEditor()?.absoluteFilePath;
        if (!filePath) return;
        void this.fileTreeController.revealPath(filePath);
    }

    /** Удаление файла: подтверждение (всегда — если безвозвратно) + запись в историю отмены. */
    private requestDeleteFile(filePath: string): void {
        const willTrash = this.workspaceEditService.willMoveToTrash();
        const confirmDelete = this.configurationService.get<boolean>("explorer.confirmDelete", true) ?? true;
        const name = path.basename(filePath);

        const doDelete = (): void => {
            this.workspaceEditService.applyFileEdits([{ kind: "delete", from: filePath }], "Delete");
            void this.fileTreeController.refresh();
        };

        // Безвозвратное удаление подтверждаем всегда (необратимо); удаление в корзину — по настройке.
        if (willTrash && !confirmDelete) {
            doDelete();
            return;
        }
        this.showConfirmDialog(
            willTrash
                ? {
                      title: "Delete",
                      message: [`«${name}» будет перемещён в корзину.`, "Можно восстановить (Ctrl+Z или из корзины)."],
                      confirmLabel: "Move to Trash",
                      defaultButton: "confirm",
                  }
                : {
                      title: "Delete",
                      message: [
                          "⚠ Системная корзина не найдена.",
                          `«${name}» будет удалён безвозвратно — отменить нельзя.`,
                      ],
                      confirmLabel: "Delete Permanently",
                      warning: true,
                      defaultButton: "cancel",
                  },
            { onConfirm: doDelete },
        );
    }

    /** Отмена последней файловой операции; для деструктивной — переспрашивает (confirmUndo). */
    private undoWorkspace(): void {
        const element = this.undoRedoService.peekUndo(WORKSPACE_UNDO_CONTEXT);
        if (!element) return;
        const confirmUndo = this.configurationService.get<boolean>("explorer.confirmUndo", true) ?? true;

        const doUndo = (): void => {
            void this.undoRedoService.undo(WORKSPACE_UNDO_CONTEXT).then((ok) => {
                /* v8 ignore start -- defensive: peekUndo above gates on a non-empty stack, and undo() pops synchronously, so it cannot come back empty */
                if (ok) void this.fileTreeController.refresh();
                /* v8 ignore stop */
            });
        };

        if (element.confirmBeforeUndo && confirmUndo) {
            this.showConfirmDialog(
                {
                    title: "Undo",
                    message: element.confirmBeforeUndo,
                    confirmLabel: "Yes",
                    cancelLabel: "No",
                    defaultButton: "cancel",
                },
                { onConfirm: doUndo },
            );
        } else {
            doUndo();
        }
    }

    private showConfirmDialog(
        options: ConfirmDialogOptions,
        callbacks: { onConfirm: () => void; onCancel?: () => void },
    ): void {
        this.dialogs.showConfirmDialog(options, callbacks);
    }

    /**
     * Explicit Save (Ctrl+S / menu). Saves the active editor; if the file was
     * modified on disk by another process since it was opened, the write is
     * blocked (to avoid clobbering the parallel changes) and an Overwrite/Cancel
     * dialog is shown instead — mirroring VS Code's dirty-write protection.
     */
    private async runSave(): Promise<void> {
        const editor = this.editorGroupController.getActiveEditor();
        if (editor === null) return;
        const outcome = await editor.save();
        if (outcome === "no-file") {
            // Безымянный буфер (Ctrl+N) — пути ещё нет, уводим в Save As.
            await this.runSaveAs();
            return;
        }
        if (outcome === "conflict") {
            /* v8 ignore start -- defensive: editors opened via openFile() always have a file path, so fileName is never null */
            const name = editor.fileName ?? "untitled";
            /* v8 ignore stop */
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
                        void editor.save({ overwrite: true }).then(() => {
                            this.statusBarController.update();
                        });
                    },
                },
            );
            return;
        }
        this.statusBarController.update();
    }

    /**
     * Save As flow: prompt for a target path (InputBox), confirm overwrite if a
     * different file already exists, then write via {@link EditorController.saveAs}.
     */
    private async runSaveAs(): Promise<void> {
        const editor = this.editorGroupController.getActiveEditor();
        if (!editor) return;

        // Безымянный буфер (Ctrl+N) не имеет пути — стартуем от cwd/untitled.txt.
        const seed = editor.absoluteFilePath ?? path.join(process.cwd(), editor.fileName ?? "untitled.txt");
        const target = await this.quickInputController.input({
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
                this.statusBarController.update();
            } catch (error) {
                /* v8 ignore start -- defensive: surfaces a filesystem write failure (permissions/disk); not reproducible in tests */
                this.logger.error("Save As failed", { path: resolved, error: String(error) });
                /* v8 ignore stop */
            }
        };

        // Overwriting a *different* existing file → confirm first.
        if (resolved !== editor.absoluteFilePath && fs.existsSync(resolved)) {
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

    /**
     * New File / New Folder in the explorer (VS Code `explorer.newFile` /
     * `explorer.newFolder`). Prompts for a name relative to the target directory
     * (nested paths like `foo/bar.txt` are allowed and create intermediate dirs),
     * creates it via the undoable {@link WorkspaceEditService}, refreshes and
     * reveals it in the tree, and — for files — opens it in the editor.
     */
    private async runCreate(kind: "file" | "folder", explorerPath?: string): Promise<void> {
        const targetDir = explorerPath
            ? fs.statSync(explorerPath).isDirectory()
                ? explorerPath
                : path.dirname(explorerPath)
            : this.fileTreeController.getPasteTargetDir();
        if (!targetDir) return;

        const name = await this.quickInputController.input({
            title: kind === "file" ? "New File" : "New Folder",
            placeholder: kind === "file" ? "Enter file name" : "Enter folder name",
            value: "",
            validateInput: (value) => {
                const trimmed = value.trim();
                if (trimmed === "") return "Please enter a name";
                if (path.isAbsolute(trimmed)) return "Please enter a relative name";
                const segments = trimmed.split(/[\\/]/);
                if (segments.some((s) => s === "" || s === "." || s === "..")) return "Invalid name";
                // Сегменты без `.`/`..`/пустых и не абсолютный путь → результат всегда
                // строго внутри targetDir, отдельная проверка на выход не нужна.
                const resolved = path.resolve(targetDir, trimmed);
                if (fs.existsSync(resolved)) return "A file or folder with that name already exists";
                return null;
            },
        });
        if (name === undefined) return;

        const resolved = path.resolve(targetDir, name.trim());
        this.workspaceEditService.applyFileEdits(
            [{ kind: "create", to: resolved, directory: kind === "folder" }],
            kind === "file" ? "New File" : "New Folder",
        );
        await this.fileTreeController.refresh();
        await this.fileTreeController.revealPath(resolved);
        if (kind === "file") {
            this.editorGroupController.openFile(resolved);
            this.updateContextKeys();
            this.statusBarController.update();
        }
    }

    /**
     * Expand a leading `~` to the home directory, then resolve the path against
     * the current workspace root (falling back to the process cwd). Returns null
     * for an empty input.
     */
    private resolveInputPath(value: string): string | null {
        const trimmed = value.trim();
        if (trimmed === "") return null;
        const expanded =
            trimmed === "~" || trimmed.startsWith("~/") ? path.join(os.homedir(), trimmed.slice(1)) : trimmed;
        return path.resolve(this.workspaceRoot(), expanded);
    }

    /** Current workspace root, or the process cwd when no folder is open. */
    private workspaceRoot(): string {
        return this.fileTreeController.getRootPath() ?? process.cwd();
    }

    /**
     * Open File flow: prompt for a path (InputBox), validate it points at an
     * existing file, then open it in the active editor group. The prompt opens
     * empty; a relative path is resolved against the workspace root.
     */
    private async runOpenFile(): Promise<void> {
        const target = await this.quickInputController.input({
            title: "Open File",
            placeholder: "Enter a file path",
            validateInput: (value) => {
                const resolved = this.resolveInputPath(value);
                // Empty is not flagged (fresh prompt shows no error); Enter is a no-op.
                if (!resolved) return null;
                if (!fs.existsSync(resolved)) return `File does not exist: ${resolved}`;
                if (fs.statSync(resolved).isDirectory()) return "That is a folder, not a file";
                return null;
            },
        });
        if (target === undefined) return;
        // An accepted-but-empty value resolves to null → nothing to open.
        const resolved = this.resolveInputPath(target);
        if (resolved) this.openFile(resolved);
    }

    /**
     * Open Folder flow: prompt for a path (InputBox), validate it points at an
     * existing directory, then swap the workspace root to it (file tree, side
     * panel and the Quick Open search index all re-target the new folder).
     */
    private async runOpenFolder(): Promise<void> {
        const target = await this.quickInputController.input({
            title: "Open Folder",
            placeholder: "Enter a folder path",
            validateInput: (value) => {
                const resolved = this.resolveInputPath(value);
                // Empty is not flagged (fresh prompt shows no error); Enter is a no-op.
                if (!resolved) return null;
                if (!fs.existsSync(resolved)) return `Folder does not exist: ${resolved}`;
                if (!fs.statSync(resolved).isDirectory()) return "That is a file, not a folder";
                return null;
            },
        });
        if (target === undefined) return;
        // An accepted-but-empty value resolves to null → nothing to swap to.
        const resolved = this.resolveInputPath(target);
        if (resolved) this.setWorkspaceFolder(resolved);
    }

    /**
     * Color-theme picker (VS Code `workbench.action.selectTheme`). Lists every
     * registered theme, applies it live as you arrow through the list, and on
     * Enter persists the choice to `workbench.colorTheme`. Escape / dismiss
     * restores the theme that was active before the picker opened.
     */
    private async selectColorTheme(): Promise<void> {
        const originalTheme = this.themeService.theme;
        const descriptors = this.themeRegistry.list();

        const items = descriptors.map((d) => ({
            label: d.label,
            description: themeTypeLabel(d.type),
        }));
        const activeIndex = Math.max(
            0,
            descriptors.findIndex((d) => d.label === originalTheme.name),
        );

        const applyByLabel = (label: string): void => {
            const theme = this.themeRegistry.resolve(label);
            /* v8 ignore start -- defensive: `label` always originates from the registry's own list()/picker items, so resolve() never returns undefined */
            if (theme) this.themeService.setTheme(theme);
            /* v8 ignore stop */
        };

        const picked = await this.quickInputController.quickPick({
            title: "Color Theme",
            placeholder: "Select Color Theme (Up/Down Keys to Preview)",
            items,
            activeIndex,
            onDidChangeActive: (item) => {
                if (item) applyByLabel(item.label);
            },
        });

        if (picked === undefined) {
            // Cancelled — undo any live preview by restoring the original theme.
            this.themeService.setTheme(originalTheme);
            return;
        }

        applyByLabel(picked.label);
        void this.configurationService.updateUserValue?.("workbench.colorTheme", picked.label);
    }

    public showAboutDialog(): void {
        this.dialogs.showAboutDialog();
    }

    private showFileTreeContextMenu(filePath: string, screenX: number, screenY: number): void {
        this.hideFileTreeContextMenu();

        const entries: MenuEntry[] = [
            {
                label: "New File...",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    this.commands.execute("explorer.newFile", filePath);
                },
            },
            {
                label: "New Folder...",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    this.commands.execute("explorer.newFolder", filePath);
                },
            },
            { type: "separator" },
            {
                label: "Copy",
                shortcut: "Ctrl+C",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    this.commands.execute("fileOperations.copy");
                },
            },
            {
                label: "Cut",
                shortcut: "Ctrl+X",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    this.commands.execute("fileOperations.cut");
                },
            },
        ];
        if (this.fileClipboard.read() !== null) {
            entries.push({
                label: "Paste",
                shortcut: "Ctrl+V",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    this.commands.execute("fileOperations.paste");
                },
            });
        }
        entries.push(
            { type: "separator" },
            {
                label: "Copy Path",
                shortcut: "Shift+Alt+C",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    this.commands.execute("fileOperations.copyPath", filePath);
                },
            },
            {
                label: "Copy Relative Path",
                shortcut: "Ctrl+K Ctrl+Shift+C",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    this.commands.execute("fileOperations.copyRelativePath", filePath);
                },
            },
            { type: "separator" },
            {
                label: "Delete",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    this.commands.execute("fileOperations.deleteFile", filePath);
                },
            },
            { type: "separator" },
            {
                // Re-read the directory contents from disk (external changes the
                // live watcher might have missed — network shares, ignored paths).
                label: "Refresh Explorer",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    this.commands.execute("workbench.files.action.refreshFilesExplorer");
                },
            },
        );

        const menu = new PopupMenuElement(entries);
        menu.applyTheme(this.themeService.theme);
        menu.tabIndex = 0;

        let session: OverlaySessionHandle | null = null;
        session = this.view.overlayLayer.openPopupSession(
            menu,
            { screenX, screenY },
            {
                visible: true,
                restoreFocus: true,
                focusOnOpen: true,
                closeOnEscape: true,
                pointerPolicy: "close-on-outside",
                disposeOnClose: true,
                onClose: () => {
                    // Через hideFileTreeContextMenu поле уже занулено до close() — не трогаем
                    // (там может быть уже открыта следующая сессия).
                    if (this.fileTreeContextMenuSession === session) {
                        this.fileTreeContextMenuSession = null;
                    }
                },
            },
        );

        menu.onClose = () => {
            session.close();
        };

        this.fileTreeContextMenuSession = session;
    }

    private hideFileTreeContextMenu(): void {
        if (!this.fileTreeContextMenuSession) return;
        const session = this.fileTreeContextMenuSession;
        this.fileTreeContextMenuSession = null;
        // Именно close(), не dispose(): close восстанавливает сохранённый фокус (restoreFocus),
        // а disposeOnClose доведёт teardown до конца.
        session.close();
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
