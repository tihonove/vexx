import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { token } from "../Common/DiContainer.ts";
import { Uri } from "../Common/Uri.ts";
import { Disposable } from "../Common/Disposable.ts";
import { Point } from "../Common/GeometryPromitives.ts";
import type { IFileClipboard } from "../Common/IFileClipboard.ts";
import type { ILogger } from "../Common/Logging/ILogger.ts";
import type { ILogService } from "../Common/Logging/ILogService.ts";
import { ILogServiceDIToken } from "../Common/Logging/ILogServiceDIToken.ts";
import type { IConfigurationService } from "../Configuration/IConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../Configuration/IConfigurationServiceDIToken.ts";
import type { IUserKeybindingRule } from "../Configuration/KeybindingsService.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import { SUPPORTED_ENCODINGS } from "../Editor/Encoding.ts";
import { EndOfLine } from "../Editor/EndOfLine.ts";
import type { ThemeRegistry } from "../Theme/ThemeRegistry.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeRegistryDIToken, ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { TUIFocusEvent } from "../TUIDom/Events/TUIFocusEvent.ts";
import type { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";
import { AboutDialogElement } from "../TUIDom/Widgets/AboutDialogElement.tsx";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import type { ConfirmDialogOptions } from "../TUIDom/Widgets/ConfirmDialogElement.tsx";
import { ConfirmDialogElement } from "../TUIDom/Widgets/ConfirmDialogElement.tsx";
import { ConfirmSaveDialogElement } from "../TUIDom/Widgets/ConfirmSaveDialogElement.tsx";
import { InputElement } from "../TUIDom/Widgets/InputElement.ts";
import type { MenuBarItem } from "../TUIDom/Widgets/MenuBarElement.ts";
import { MenuBarElement } from "../TUIDom/Widgets/MenuBarElement.ts";
import type { OverlaySessionHandle } from "../TUIDom/Widgets/OverlayLayer.ts";
import type { MenuEntry, MenuItemEntry } from "../TUIDom/Widgets/PopupMenuElement.ts";
import { PopupMenuElement } from "../TUIDom/Widgets/PopupMenuElement.ts";
import { TerminalViewElement } from "../TUIDom/Widgets/Terminal/TerminalViewElement.ts";
import { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";
import { WorkbenchLayoutElement } from "../TUIDom/Widgets/WorkbenchLayoutElement.ts";
import {
    getAboutDialogStyles,
    getConfirmDialogStyles,
    getConfirmSaveDialogStyles,
    getMenuStyles,
} from "../Workbench/Styles/defaultStyles.ts";

import { quitAction } from "./Actions/AppActions.ts";
import { clipboardCopyAction, clipboardCutAction, clipboardPasteAction } from "./Actions/ClipboardActions.ts";
import { showEditorContextMenuAction, showExplorerContextMenuAction } from "./Actions/ContextMenuActions.ts";
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
import { changeEncodingAction } from "./Actions/EncodingActions.ts";
import { changeEolAction, convertToCrlfAction, convertToLfAction, toggleEolAction } from "./Actions/EolActions.ts";
import {
    fileOpenAction,
    fileOpenFolderAction,
    fileSaveAction,
    fileSaveAsAction,
    newUntitledFileAction,
} from "./Actions/FileActions.ts";
import { fileDeleteAction, fileRenameAction } from "./Actions/FileTreeActions.ts";
import {
    buildPasteEdits,
    fileCopyAction,
    fileCopyPathAction,
    fileCopyRelativePathAction,
    fileCutAction,
    filePasteAction,
} from "./Actions/FileTreeClipboardActions.ts";
import { explorerNewFileAction, explorerNewFolderAction } from "./Actions/FileTreeCreateActions.ts";
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
import { gotoLineAction, quickOpenAction, showCommandsAction } from "./Actions/QuickOpenActions.ts";
import { closeActiveEditorAction, nextEditorInGroupAction, previousEditorInGroupAction } from "./Actions/TabActions.ts";
import { selectThemeAction } from "./Actions/ThemeActions.ts";
import {
    insertFinalNewLineAction,
    triggerSuggestAction,
    trimTrailingWhitespaceAction,
} from "./Actions/WhitespaceActions.ts";
import { registerAction } from "./CommandAction.ts";
import type { CommandRegistry } from "../Workbench/Services/CommandRegistry.ts";
import { CommandRegistryDIToken } from "../Workbench/Services/CommandRegistry.ts";
import { CompletionController } from "./CompletionController.ts";
import { registerContextKeys } from "../Workbench/Services/ContextKeys.ts";
import type { ContextKeyService } from "../Workbench/Services/ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "../Workbench/Services/ContextKeyService.ts";
import {
    ClipboardDIToken,
    FileClipboardDIToken,
    KeybindingsResourceDIToken,
    ServiceAccessorDIToken,
    SettingsResourceDIToken,
    TuiApplicationDIToken,
} from "../Workbench/Services/CoreTokens.ts";
import { DiagnosticsController, DiagnosticsControllerDIToken } from "./DiagnosticsController.ts";
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { EditorGroupController } from "./EditorGroupController.ts";
import { FileSearchService } from "../Workbench/Services/FileSearchService.ts";
import { FileTreeController } from "./FileTreeController.ts";
import { FindController } from "./FindController.ts";
import type { IController } from "./IController.ts";
import { InputWidgetController, InputWidgetControllerDIToken } from "./InputWidgetController.ts";
import type { Keybinding, KeybindingRegistry } from "../Workbench/Services/KeybindingRegistry.ts";
import { formatKeybinding, KeybindingRegistryDIToken, parseChord, parseKeybinding } from "../Workbench/Services/KeybindingRegistry.ts";
import { type CommandTrigger, ModifierReleaseArmory, ModifierReleaseArmoryDIToken } from "../Workbench/Services/ModifierReleaseArmory.ts";
import { UserKeybindingsDIToken } from "./Modules/KeybindingsModule.ts";
import { StateServiceDIToken } from "./Modules/StateModule.ts";
import { PanelController, PanelControllerDIToken } from "./PanelController.ts";
import { ProblemsController, ProblemsControllerDIToken } from "./ProblemsController.ts";
import { TerminalController, TerminalControllerDIToken } from "./TerminalController.ts";
import { QuickInputController } from "./QuickInputController.ts";
import { QuickOpenController } from "./QuickOpenController.ts";
import { StatusBarControllerDIToken } from "./StatusBarController.ts";
import { StatusBarController } from "./StatusBarController.ts";
import type { TerminalEnvironmentService } from "../Workbench/Services/TerminalEnvironment/TerminalEnvironmentService.ts";
import { TerminalEnvironmentServiceDIToken } from "../Workbench/Services/TerminalEnvironment/TerminalEnvironmentService.ts";
import { UndoRedoService, UndoRedoServiceDIToken, WORKSPACE_UNDO_CONTEXT } from "../Workbench/Services/Workspace/UndoRedoService.ts";
import { WorkspaceEditService, WorkspaceEditServiceDIToken } from "./Workspace/WorkspaceEditService.ts";
import { WorkbenchStateController } from "./WorkbenchStateController.ts";

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

    // Context menu (Shift+F10)
    showEditorContextMenuAction,
    showExplorerContextMenuAction,

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

// How long to wait for the next chord part before cancelling (matches VS Code).
// Columns added/removed per increase/decrease Side Bar Width command.
const SIDEBAR_WIDTH_STEP = 3;

const CHORD_TIMEOUT_MS = 5000;

// How long the "… is not a command" status message lingers after a broken chord.
const CHORD_NOT_FOUND_MS = 4000;

// Context keys that reflect WHAT IS FOCUSED (set from `activeElement` in updateContextKeys).
// A keybinding whose `when` names one of these is scoped to the focused input/list/editor —
// e.g. clipboard / undo / cursor commands that edit the focused widget. While a capturing overlay
// (quickpick, dialog, menu) owns the keyboard, only such focus-scoped commands may run; everything
// else (workbench/navigation commands, which carry no focus-scoped `when`) is suppressed so a
// shortcut can't act on a panel behind the still-visible overlay. See dispatchKey.
const FOCUS_SCOPED_CONTEXT_KEYS = ["inputWidgetFocus", "textInputFocus", "listFocus"] as const;

function isFocusScopedWhen(when: string | undefined): boolean {
    return when !== undefined && FOCUS_SCOPED_CONTEXT_KEYS.some((key) => when.includes(key));
}

// Modifier keys that arrive as standalone keydowns (Kitty protocol). They must
// not break or advance an in-progress chord.
const modifierKeyNames = new Set(["Control", "Shift", "Alt", "Meta", "Hyper", "Super", "AltGraph", "CapsLock"]);

function isModifierKey(key: string): boolean {
    return modifierKeyNames.has(key);
}

/**
 * A CSI-u encoded key (`ESC [ <code>[;<mods>] u`). A key only arrives in this form when the
 * Kitty keyboard protocol / xterm modifyOtherKeys is actually engaged — so receiving one is
 * proof of `extended-keys` support, even behind tmux where the capability probe can't confirm.
 */
// eslint-disable-next-line no-control-regex
const CSI_U_KEY_RAW = /^\x1b\[[0-9;:]*u$/;

function eventToKeybinding(event: TUIKeyboardEvent): Keybinding {
    return {
        key: event.key,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
    };
}

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
    private confirmDialog: ConfirmSaveDialogElement | null = null;
    private confirmDialogSession: OverlaySessionHandle | null = null;
    private aboutDialog: AboutDialogElement | null = null;
    private aboutDialogSession: OverlaySessionHandle | null = null;
    private confirmActionSession: OverlaySessionHandle | null = null;
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
    private terminalController: TerminalController;
    private commands: CommandRegistry;
    private keybindings: KeybindingRegistry;
    private contextKeys: ContextKeyService;
    private inputWidgetController: InputWidgetController;
    private themeService: ThemeService;
    private themeRegistry: ThemeRegistry;
    private menuBar: MenuBarElement | null = null;
    private terminalEnv: TerminalEnvironmentService;
    private armory: ModifierReleaseArmory;
    private chordTimer: ReturnType<typeof setTimeout> | null = null;
    private notFoundTimer: ReturnType<typeof setTimeout> | null = null;
    private swallowNextKeyPress = false;
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
        this.armory = accessor.get(ModifierReleaseArmoryDIToken);
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
        this.terminalController = this.register(accessor.get(TerminalControllerDIToken));
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
        this.register({
            dispose: () => {
                this.clearChordTimeout();
                this.clearNotFoundTimer();
            },
        });
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
                ...changeEncodingAction,
                run: () => {
                    void this.changeFileEncoding();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...changeEolAction,
                run: () => {
                    void this.changeEol();
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
                        this.workbenchLayout.getBottomPanelVisible() && this.panelController.isTerminalActive();
                    if (showing) {
                        this.setPanelVisible(false);
                    } else {
                        this.panelController.showTerminal();
                        this.setPanelVisible(true);
                        this.terminalController.openTerminal();
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
                    this.panelController.showTerminal();
                    this.setPanelVisible(true);
                    this.terminalController.newTerminal();
                    this.updateContextKeys();
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
                ...fileRenameAction,
                run: (_a, ...args) => {
                    const filePath = (args[0] as string | undefined) ?? this.fileTreeController.getSelectedPaths()[0];
                    if (filePath) void this.runRename(filePath);
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
        this.applyUserKeybindings(userKeybindings);

        this.setupMenu();
        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
        // Live-reload: смена `workbench.colorTheme` в settings.json перекрашивает UI
        // без рестарта. Explorer-настройки (`explorer.*`) читаются on-demand, поэтому
        // отдельная подписка им не нужна — reload модели применяет их сам. Editor-
        // настройки перепримeняет EditorGroupController.
        this.register(
            this.configurationService.onDidChangeConfiguration((event) => {
                if (!event.affectsConfiguration("workbench.colorTheme")) return;
                this.applyColorThemeFromConfiguration();
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
        // Capture-phase listeners run before the focused widget (the target),
        // so while a chord is in progress they can swallow keys entirely —
        // keeping them out of the editor whether or not they match a command.
        this.view.addEventListener("keydown", this.handleKeyDownCapture, { capture: true });
        this.view.addEventListener("keypress", this.handleKeyPressCapture, { capture: true });
        this.view.addEventListener("keydown", this.handleKeyDown);
        this.view.addEventListener("keypress", this.handleKeyPress);
        this.view.addEventListener("keyup", this.handleKeyUp);
        this.view.addEventListener("focus", this.handleFocusChange, { capture: true });
        this.view.addEventListener("blur", this.handleFocusChange, { capture: true });
        this.editorGroupController.mount();
        this.editorGroupController.onRequestConfirmClose = (index) => {
            const editor = this.editorGroupController.getEditor(index);
            /* v8 ignore start -- defensive: the callback is only invoked synchronously with a valid tab index, so the editor always exists */
            if (!editor) return;
            /* v8 ignore stop */
            this.showConfirmSaveDialog(this.editorGroupController.displayName(editor), {
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
        this.terminalController.mount();
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
        this.statusBarController.update();
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
        // Новые терминалы спавнятся в папке воркспейса.
        this.terminalController.setWorkingDirectory(dirPath);
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
        this.confirmDialog?.setStyles(getConfirmSaveDialogStyles(theme));
        this.aboutDialog?.setStyles(getAboutDialogStyles(theme));
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

    // Capture phase: while a chord is in progress, intercept the next key
    // before it reaches the focused widget and swallow it entirely — so the
    // continuation key never leaks into the editor, matched or not.
    private handleKeyDownCapture = (event: TUIKeyboardEvent): void => {
        this.observeExtendedKeys(event);
        if (this.keybindings.pendingLength === 0) return; // not in a chord — let the bubble handler run
        if (isModifierKey(event.key)) return; // holding a modifier must not break the chord
        event.preventDefault();
        event.stopImmediatePropagation();
        this.dispatchKey(event);
    };

    /**
     * Promote the terminal tier off `legacy` the moment a CSI-u key actually arrives — the only
     * reliable extended-keys signal behind tmux, which drops the startup capability probe.
     */
    private observeExtendedKeys(event: TUIKeyboardEvent): void {
        if (this.terminalEnv.hasCapability("extended-keys")) return;
        if (CSI_U_KEY_RAW.test(event.raw)) this.terminalEnv.noteExtendedKeysObserved();
    }

    private handleKeyPressCapture = (event: TUIKeyboardEvent): void => {
        if (!this.swallowNextKeyPress) return;
        this.swallowNextKeyPress = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    // Bubble phase: only reached when no chord is pending (otherwise the capture
    // handler stops propagation). Handles ordinary bindings and chord starts.
    private handleKeyDown = (event: TUIKeyboardEvent): void => {
        if (this.dispatchKey(event)) {
            event.preventDefault();
        }
    };

    /**
     * Resolves a key against the keybinding registry and applies the outcome
     * (run command, enter/cancel chord mode, update the status-bar hint).
     * Returns true if the key was consumed (caller should preventDefault).
     */
    private dispatchKey(event: TUIKeyboardEvent): boolean {
        this.updateContextKeys();
        this.clearChordTimeout();
        this.clearNotFoundTimer();
        this.swallowNextKeyPress = false;
        const pendingBefore = this.keybindings.pendingLength;
        // Capture the chord prefix BEFORE resolving (resolveKey clears it on a break).
        const prefix = pendingBefore > 0 ? this.keybindings.getPendingChord(this.contextKeys) : [];
        const res = this.keybindings.resolveKey(event, this.contextKeys);

        this.logger.debug("keydown", {
            key: event.key,
            code: event.code,
            ctrl: event.ctrlKey,
            shift: event.shiftKey,
            alt: event.altKey,
            meta: event.metaKey,
            pendingBefore,
            result: res.kind,
            commandId: res.kind === "command" ? res.commandId : undefined,
            chord: res.kind === "chord" ? formatKeybinding(res.chord) : undefined,
        });

        // Keyboard modality, symmetric to the pointer path (OverlayLayer.elementFromPoint stops a
        // click landing behind a modal). While a quickpick / dialog / menu owns the keyboard, only
        // commands scoped to the focused input/list/editor (their `when` names a focus context key
        // — e.g. clipboard / undo inside the quickpick query) may run. Workbench/navigation commands
        // are suppressed so a shortcut can't act on a panel behind the still-visible overlay.
        const overlayCaptures = this.view.overlayLayer.hasKeyboardCapturingOverlay();

        if (res.kind === "chord") {
            if (overlayCaptures) {
                // No new chord may start while an overlay owns the keyboard.
                this.keybindings.resetPending();
                this.statusBarController.setChordHint(null);
                return false;
            }
            // Prefix key of a chord — swallow its keypress and wait for the next.
            this.swallowNextKeyPress = true;
            this.statusBarController.setChordHint(
                `(${formatKeybinding(res.chord)}) was pressed. Waiting for next key…`,
            );
            this.startChordTimeout();
            return true;
        }

        // A continuation key (command or none) ends chord mode; its keypress
        // must be swallowed too so a broken chord does not leak into the editor.
        const wasInChord = pendingBefore > 0;
        if (wasInChord) this.swallowNextKeyPress = true;

        if (res.kind === "command" && this.commands.has(res.commandId)) {
            if (overlayCaptures && !isFocusScopedWhen(res.when)) {
                // A workbench/navigation shortcut fired while an overlay owns the keyboard:
                // swallow it (no preventDefault) instead of acting behind the overlay.
                this.statusBarController.setChordHint(null);
                return false;
            }
            this.statusBarController.setChordHint(null);
            // Даём команде контекст модификаторов аккорда: команды с «hold-сессией»
            // (MRU-вкладки) взводят коммит на отпускание удерживающего модификатора
            // именно по ним. Через контекст, а не позиционный аргумент — чтобы не
            // конфликтовать с командами, у которых есть свои аргументы.
            const trigger: CommandTrigger = {
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
            };
            this.armory.withTrigger(trigger, () => this.commands.execute(res.commandId));
            // A key that would otherwise be TYPED into the editor still emits a paired
            // keypress (preventDefault on keydown does not suppress it — only
            // swallowNextKeyPress does). When such a key ran a command over a text input
            // (e.g. Enter → acceptSelectedSuggestion), swallow the keypress so it does
            // not also insert a newline/character behind the command. Gated on
            // textInputFocus to keep inputs/lists/find untouched.
            const wouldType =
                event.key === "Enter" ||
                (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey);
            if (wouldType && this.contextKeys.get("textInputFocus") === true) {
                this.swallowNextKeyPress = true;
            }
            return true;
        }

        if (wasInChord) {
            // Broken chord: report the unmatched combination, like VS Code.
            const combo = formatKeybinding([...prefix, eventToKeybinding(event)]);
            this.showChordNotFound(combo);
            return true; // consumed (no command, no leak)
        }

        this.statusBarController.setChordHint(null);
        return false;
    }

    private showChordNotFound(combo: string): void {
        this.statusBarController.setChordHint(`(${combo}) is not a command`);
        this.notFoundTimer = setTimeout(() => {
            this.notFoundTimer = null;
            this.statusBarController.setChordHint(null);
        }, CHORD_NOT_FOUND_MS);
    }

    private clearNotFoundTimer(): void {
        if (this.notFoundTimer !== null) {
            clearTimeout(this.notFoundTimer);
            this.notFoundTimer = null;
        }
    }

    private startChordTimeout(): void {
        this.chordTimer = setTimeout(() => {
            this.chordTimer = null;
            this.keybindings.resetPending();
            this.swallowNextKeyPress = false;
            this.statusBarController.setChordHint(null);
        }, CHORD_TIMEOUT_MS);
    }

    private clearChordTimeout(): void {
        if (this.chordTimer !== null) {
            clearTimeout(this.chordTimer);
            this.chordTimer = null;
        }
    }

    private cancelPendingChord(): void {
        if (this.keybindings.pendingLength > 0) {
            this.logger.debug("chord cancelled (focus change / timeout)");
        }
        this.clearChordTimeout();
        this.clearNotFoundTimer();
        this.keybindings.resetPending();
        this.swallowNextKeyPress = false;
        this.statusBarController.setChordHint(null);
    }

    private handleKeyPress = (): void => {
        this.statusBarController.update();
    };

    // Отпускание модификатора завершает «hold-сессии» команд (MRU-переключение
    // вкладок и т.п.) через ModifierReleaseArmory. Какой именно модификатор ждать,
    // решает сама команда по своему аккорду — здесь только маршрутизация keyup.
    // Требует Kitty keyboard protocol с event types: только он присылает keyup для
    // одиночного модификатора.
    private handleKeyUp = (event: TUIKeyboardEvent): void => {
        this.armory.fireRelease(event.key);
    };

    private handleFocusChange = (_event: TUIFocusEvent): void => {
        this.cancelPendingChord();
        this.updateContextKeys();
        // Фокус ушёл с редактора (клавиатурный путь: Ctrl+Tab, Quick Open) —
        // закрываем suggest-попап (клик-фокус уже покрыт close-on-outside).
        const active = this.view.focusManager?.activeElement ?? null;
        this.completionController.onFocusChanged(active instanceof EditorElement);
    };

    /**
     * Applies user `keybindings.json` rules. A `-command` rule unbinds (the exact key, or all
     * bindings for the command if no key); other rules add a binding that wins over defaults.
     * `when` may reference tier / cap_* / mode_* / os.
     */
    private applyUserKeybindings(rules: readonly IUserKeybindingRule[]): void {
        for (const rule of rules) {
            if (rule.command.startsWith("-")) {
                const commandId = rule.command.slice(1);
                this.keybindings.removeBindings(commandId, rule.key ? parseChord(rule.key) : undefined);
            } else {
                this.register(this.keybindings.register(parseChord(rule.key), rule.command, rule.when));
            }
        }
    }

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
        this.contextKeys.set("terminalFocus", active instanceof TerminalViewElement);
        this.contextKeys.set("terminalIsOpen", this.terminalController.hasOpenTerminals);

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
        if (!this.confirmDialog) {
            this.confirmDialog = new ConfirmSaveDialogElement(filename);
            this.confirmDialog.setStyles(getConfirmSaveDialogStyles(this.themeService.theme));
            this.confirmDialogSession = this.view.overlayLayer.createSession(this.confirmDialog, new Point(0, 0), {
                visible: false,
                restoreFocus: true,
                closeOnEscape: true,
                pointerPolicy: "modal",
            });
        } else {
            this.confirmDialog.setFilename(filename);
        }

        this.confirmDialog.onSave = () => {
            this.hideConfirmSaveDialog();
            callbacks.onSave();
        };
        this.confirmDialog.onDontSave = () => {
            this.hideConfirmSaveDialog();
            callbacks.onDontSave();
        };
        this.confirmDialog.onCancel = () => {
            this.hideConfirmSaveDialog();
        };

        const screenW = this.view.layoutSize.width;
        const screenH = this.view.layoutSize.height;
        const dialogW = this.confirmDialog.getMaxIntrinsicWidth(0);
        const dialogH = this.confirmDialog.getMaxIntrinsicHeight(dialogW);
        const px = Math.max(0, Math.floor((screenW - dialogW) / 2));
        const py = Math.max(0, Math.floor((screenH - dialogH) / 2));
        this.confirmDialogSession?.setPosition(new Point(px, py));

        this.confirmDialogSession?.open();
        this.confirmDialog.focusDefault();
    }

    private hideConfirmSaveDialog(): void {
        /* v8 ignore start -- defensive: only invoked from dialog callbacks after showConfirmSaveDialog() created the dialog (which is never reset to null) */
        if (!this.confirmDialog) return;
        /* v8 ignore stop */
        this.confirmDialogSession?.close();
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
        this.hideConfirmActionDialog();

        const dialog = new ConfirmDialogElement(options);
        dialog.setStyles(getConfirmDialogStyles(this.themeService.theme));
        dialog.onConfirm = () => {
            this.hideConfirmActionDialog();
            callbacks.onConfirm();
        };
        dialog.onCancel = () => {
            this.hideConfirmActionDialog();
            callbacks.onCancel?.();
        };

        const session = this.view.overlayLayer.createSession(dialog, new Point(0, 0), {
            visible: false,
            restoreFocus: true,
            closeOnEscape: true,
            pointerPolicy: "modal",
            disposeOnClose: true,
        });
        this.confirmActionSession = session;

        const screenW = this.view.layoutSize.width;
        const screenH = this.view.layoutSize.height;
        const dialogW = dialog.getMaxIntrinsicWidth(0);
        const dialogH = dialog.getMaxIntrinsicHeight(dialogW);
        session.setPosition(
            new Point(
                Math.max(0, Math.floor((screenW - dialogW) / 2)),
                Math.max(0, Math.floor((screenH - dialogH) / 2)),
            ),
        );
        session.open();
        dialog.focusDefault();
    }

    private hideConfirmActionDialog(): void {
        this.confirmActionSession?.close();
        this.confirmActionSession = null;
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
            const name = this.editorGroupController.displayName(editor);
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

        // Безымянный буфер (Ctrl+N) не имеет пути — стартуем от cwd и предложенного
        // имени (`Untitled-3.txt`: метка буфера + расширение его языка).
        const seed =
            editor.uri.scheme === "file"
                ? editor.uri.fsPath
                : path.join(process.cwd(), this.editorGroupController.suggestedSaveName(editor));
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
     * Rename a file or folder in the explorer (VS Code `renameFile`, F2). Prompts
     * for the new name pre-filled with the current basename, renames it in place via
     * the undoable {@link WorkspaceEditService}, then refreshes and reveals it.
     */
    private async runRename(filePath: string): Promise<void> {
        const parentDir = path.dirname(filePath);
        const oldName = path.basename(filePath);

        const name = await this.quickInputController.input({
            title: "Rename",
            placeholder: "Enter new name",
            value: oldName,
            validateInput: (value) => {
                const trimmed = value.trim();
                if (trimmed === "") return "Please enter a name";
                if (path.isAbsolute(trimmed)) return "Please enter a relative name";
                const segments = trimmed.split(/[\\/]/);
                if (segments.some((s) => s === "" || s === "." || s === "..")) return "Invalid name";
                if (trimmed === oldName) return null; // без изменений — валидно, но ниже это no-op
                const resolved = path.resolve(parentDir, trimmed);
                if (fs.existsSync(resolved)) return "A file or folder with that name already exists";
                return null;
            },
        });
        if (name === undefined) return;

        const trimmed = name.trim();
        if (trimmed === oldName) return; // имя не изменилось — ничего не делаем
        const resolved = path.resolve(parentDir, trimmed);
        this.workspaceEditService.applyFileEdits([{ kind: "rename", from: filePath, to: resolved }], "Rename");
        await this.fileTreeController.refresh();
        await this.fileTreeController.revealPath(resolved);
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

    /**
     * Encoding picker (VS Code `workbench.action.editor.changeEncoding`):
     * двухуровневый флоу — сначала «Reopen with Encoding» / «Save with
     * Encoding», затем список кодировок с текущей в активной позиции.
     * «Reopen» скрыт для буферов без файла на диске (untitled); на «грязном»
     * буфере он сначала спрашивает подтверждение (перечитка отбрасывает
     * несохранённые правки). «Save» у безымянного буфера выставляет кодировку
     * и уводит в Save As; конфликт с внешней записью идёт через тот же
     * Overwrite-диалог, что и обычный Save.
     */
    private async changeFileEncoding(): Promise<void> {
        const editor = this.editorGroupController.getActiveEditor();
        if (editor === null) return;

        const canReopen = editor.absoluteFilePath !== null && fs.existsSync(editor.absoluteFilePath);
        const modeItems = [
            ...(canReopen
                ? [{ label: "Reopen with Encoding", description: "Reinterpret the file on disk" }]
                : []),
            { label: "Save with Encoding", description: "Write the file in a different encoding" },
        ];
        const mode = await this.quickInputController.quickPick({
            title: "Change File Encoding",
            placeholder: "Select Action",
            items: modeItems,
        });
        if (mode === undefined) return;

        const current = editor.encoding;
        const encodingItems = SUPPORTED_ENCODINGS.map((info) => ({ label: info.label, description: info.id }));
        const picked = await this.quickInputController.quickPick({
            title: mode.label,
            placeholder: "Select File Encoding",
            items: encodingItems,
            activeIndex: Math.max(
                0,
                SUPPORTED_ENCODINGS.findIndex((info) => info.id === current),
            ),
        });
        if (picked === undefined || picked.description === undefined) return;
        const encoding = picked.description;

        if (mode.label === "Reopen with Encoding") {
            const doReopen = (): void => {
                editor.reopenWithEncoding(encoding);
                this.statusBarController.update();
            };
            if (editor.isModified) {
                const name = this.editorGroupController.displayName(editor);
                this.showConfirmDialog(
                    {
                        title: "Reopen with Encoding",
                        message: [
                            `"${name}" has unsaved changes.`,
                            "Reopening the file will discard them. Continue?",
                        ],
                        confirmLabel: "Reopen",
                        cancelLabel: "Cancel",
                        defaultButton: "cancel",
                    },
                    { onConfirm: doReopen },
                );
                return;
            }
            doReopen();
            return;
        }

        const outcome = await editor.saveWithEncoding(encoding);
        if (outcome === "no-file") {
            // Безымянный буфер: кодировка уже выставлена, путь спросит Save As.
            await this.runSaveAs();
            return;
        }
        if (outcome === "conflict") {
            const name = this.editorGroupController.displayName(editor);
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
     * EOL picker (VS Code `workbench.action.editor.changeEOL`): quick pick с
     * LF / CRLF, активная позиция — текущий EOL документа.
     */
    private async changeEol(): Promise<void> {
        const editor = this.editorGroupController.getActiveEditor();
        if (editor === null) return;

        const picked = await this.quickInputController.quickPick({
            title: "Change End of Line Sequence",
            placeholder: "Select End of Line Sequence",
            items: [
                { label: "LF", description: "\\n" },
                { label: "CRLF", description: "\\r\\n" },
            ],
            activeIndex: editor.eol === EndOfLine.CRLF ? 1 : 0,
        });
        if (picked === undefined) return;

        editor.setEol(picked.label === "CRLF" ? EndOfLine.CRLF : EndOfLine.LF);
        this.statusBarController.update();
    }

    public showAboutDialog(): void {
        if (!this.aboutDialog) {
            this.aboutDialog = new AboutDialogElement();
            this.aboutDialog.setStyles(getAboutDialogStyles(this.themeService.theme));
            this.aboutDialog.onClose = () => {
                this.hideAboutDialog();
            };
            this.aboutDialogSession = this.view.overlayLayer.createSession(this.aboutDialog, new Point(0, 0), {
                visible: false,
                restoreFocus: true,
                closeOnEscape: true,
                pointerPolicy: "modal",
            });
        }

        const screenW = this.view.layoutSize.width;
        const screenH = this.view.layoutSize.height;
        const dialogW = this.aboutDialog.getMaxIntrinsicWidth(0);
        const dialogH = this.aboutDialog.getMaxIntrinsicHeight(dialogW);
        const px = Math.max(0, Math.floor((screenW - dialogW) / 2));
        const py = Math.max(0, Math.floor((screenH - dialogH) / 2));
        this.aboutDialogSession?.setPosition(new Point(px, py));

        this.aboutDialogSession?.open();
        this.aboutDialog.focusDefault();
    }

    private hideAboutDialog(): void {
        /* v8 ignore start -- defensive: only invoked from the dialog callback after showAboutDialog() created the dialog */
        if (!this.aboutDialog) return;
        /* v8 ignore stop */
        this.aboutDialogSession?.close();
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
                label: "Rename...",
                shortcut: "F2",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    this.commands.execute("fileOperations.rename", filePath);
                },
            },
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
        menu.setStyles(getMenuStyles(this.themeService.theme));
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
        this.showConfirmSaveDialog(this.editorGroupController.displayName(editor), {
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
