import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import { Point } from "../Common/GeometryPromitives.ts";
import type { ILogger } from "../Common/Logging/ILogger.ts";
import type { ILogService } from "../Common/Logging/ILogService.ts";
import { ILogServiceDIToken } from "../Common/Logging/ILogServiceDIToken.ts";
import type { IUserKeybindingRule } from "../Configuration/KeybindingsService.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { TUIFocusEvent } from "../TUIDom/Events/TUIFocusEvent.ts";
import type { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";
import { AboutDialogElement } from "../TUIDom/Widgets/AboutDialogElement.tsx";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import { ConfirmSaveDialogElement } from "../TUIDom/Widgets/ConfirmSaveDialogElement.tsx";
import { InputElement } from "../TUIDom/Widgets/InputElement.ts";
import type { MenuBarItem } from "../TUIDom/Widgets/MenuBarElement.ts";
import { MenuBarElement } from "../TUIDom/Widgets/MenuBarElement.ts";
import type { OverlaySessionHandle } from "../TUIDom/Widgets/OverlayLayer.ts";
import type { MenuEntry, MenuItemEntry } from "../TUIDom/Widgets/PopupMenuElement.ts";
import { PopupMenuElement } from "../TUIDom/Widgets/PopupMenuElement.ts";
import { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";
import { WorkbenchLayoutElement } from "../TUIDom/Widgets/WorkbenchLayoutElement.ts";

import { quitAction } from "./Actions/AppActions.ts";
import { clipboardCopyAction, clipboardCutAction, clipboardPasteAction } from "./Actions/ClipboardActions.ts";
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
    redoAction,
    selectAllAction,
    undoAction,
} from "./Actions/EditorEditActions.ts";
import { convertToCrlfAction, convertToLfAction, toggleEolAction } from "./Actions/EolActions.ts";
import { fileSaveAction } from "./Actions/FileActions.ts";
import { fileDeleteAction } from "./Actions/FileTreeActions.ts";
import { closeFindWidgetAction, findAction, nextMatchAction, previousMatchAction } from "./Actions/FindActions.ts";
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
import { listFocusPageDownAction, listFocusPageUpAction } from "./Actions/ListActions.ts";
import { quickOpenAction, showCommandsAction } from "./Actions/QuickOpenActions.ts";
import { closeActiveEditorAction, nextEditorInGroupAction, previousEditorInGroupAction } from "./Actions/TabActions.ts";
import { registerAction } from "./CommandAction.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import { registerContextKeys } from "./ContextKeys.ts";
import type { ContextKeyService } from "./ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import { ServiceAccessorDIToken, TuiApplicationDIToken } from "./CoreTokens.ts";
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { EditorGroupController } from "./EditorGroupController.ts";
import { FileSearchService } from "./FileSearchService.ts";
import { FileTreeController } from "./FileTreeController.ts";
import { FindController } from "./FindController.ts";
import type { IController } from "./IController.ts";
import { InputWidgetController, InputWidgetControllerDIToken } from "./InputWidgetController.ts";
import type { Keybinding, KeybindingRegistry } from "./KeybindingRegistry.ts";
import { formatKeybinding, KeybindingRegistryDIToken, parseChord, parseKeybinding } from "./KeybindingRegistry.ts";
import { UserKeybindingsDIToken } from "./Modules/KeybindingsModule.ts";
import { QuickOpenController } from "./QuickOpenController.ts";
import { StatusBarControllerDIToken } from "./StatusBarController.ts";
import { StatusBarController } from "./StatusBarController.ts";
import type { TerminalEnvironmentService } from "./TerminalEnvironment/TerminalEnvironmentService.ts";
import { TerminalEnvironmentServiceDIToken } from "./TerminalEnvironment/TerminalEnvironmentService.ts";

export const AppControllerDIToken = token<AppController>("AppController");

const builtinActions = [
    // App
    fileSaveAction,

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

    // End of line
    convertToLfAction,
    convertToCrlfAction,
    toggleEolAction,

    // Clipboard
    clipboardCopyAction,
    clipboardCutAction,
    clipboardPasteAction,

    // List
    listFocusPageDownAction,
    listFocusPageUpAction,

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

    private editorGroupController: EditorGroupController;
    private confirmDialog: ConfirmSaveDialogElement | null = null;
    private confirmDialogSession: OverlaySessionHandle | null = null;
    private aboutDialog: AboutDialogElement | null = null;
    private aboutDialogSession: OverlaySessionHandle | null = null;
    private fileTreeContextMenuSession: OverlaySessionHandle | null = null;
    private fileTreeController: FileTreeController;
    private fileSearchService: FileSearchService;
    private quickOpenController: QuickOpenController;
    private findController: FindController;
    private statusBarController: StatusBarController;
    private commands: CommandRegistry;
    private keybindings: KeybindingRegistry;
    private contextKeys: ContextKeyService;
    private inputWidgetController: InputWidgetController;
    private themeService: ThemeService;
    private terminalEnv: TerminalEnvironmentService;
    private chordTimer: ReturnType<typeof setTimeout> | null = null;
    private notFoundTimer: ReturnType<typeof setTimeout> | null = null;
    private swallowNextKeyPress = false;
    private logger: ILogger;

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
        this.editorGroupController = this.register(editorGroupController);
        this.fileTreeController = this.register(new FileTreeController(themeService));
        this.fileSearchService = this.register(new FileSearchService());
        this.quickOpenController = this.register(
            new QuickOpenController(this.fileSearchService, commands, keybindings, contextKeys),
        );
        this.findController = this.register(new FindController(this.editorGroupController));
        this.findController.applyTheme(themeService.theme);
        this.statusBarController = this.register(statusBarController);
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
        this.workbenchLayout.setSashHoverColor(themeService.theme.getColor("sash.hoverBorder"));
        this.workbenchLayout.setCenterContent(this.editorGroupController.view);

        this.view = new BodyElement();
        this.view.setContent(this.workbenchLayout);
        this.view.setStatusBar(this.statusBarController.view);

        this.quickOpenController.setHostView(this.view);
        this.findController.setHostView();
        // Find operates on the active editor only — close the widget when it changes.
        this.register(
            this.editorGroupController.onActiveEditorChanged(() => {
                this.findController.close();
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
                ...findAction,
                run: () => {
                    this.findController.open();
                },
            }),
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
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileDeleteAction,
                run: (a, ...args) => {
                    fileDeleteAction.run(a, ...args);
                    void this.fileTreeController.refresh();
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
                    editor.save();
                    this.editorGroupController.closeTab(index);
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
    }

    public openFile(filePath: string): void {
        this.editorGroupController.openFile(filePath);
        this.updateContextKeys();
        this.statusBarController.update();
    }

    public setWorkspaceFolder(dirPath: string): void {
        this.fileTreeController.setRootPath(dirPath);
        this.workbenchLayout.setLeftPanel(this.fileTreeController.view);
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
        this.editorGroupController.focusEditor();
    }

    private applyTheme(theme: WorkbenchTheme): void {
        const fg = theme.getColor("foreground");
        const bg = theme.getColor("editor.background");
        this.view.style = {
            ...(fg !== undefined ? { fg } : {}),
            ...(bg !== undefined ? { bg } : {}),
        };
        this.confirmDialog?.applyTheme(theme);
        this.aboutDialog?.applyTheme(theme);
        this.findController.applyTheme(theme);
        this.workbenchLayout.setSashHoverColor(theme.getColor("sash.hoverBorder"));
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
            this.commands.execute(res.commandId);
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

    private handleFocusChange = (_event: TUIFocusEvent): void => {
        this.cancelPendingChord();
        this.updateContextKeys();
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

    private updateContextKeys(): void {
        const active = this.view.focusManager?.activeElement ?? null;
        const editorCount = this.editorGroupController.editorCount;

        this.contextKeys.set("textInputFocus", active instanceof EditorElement);
        this.contextKeys.set("inputWidgetFocus", active instanceof InputElement);
        this.contextKeys.set("listFocus", active instanceof TreeViewElement);
        this.inputWidgetController.setActive(active instanceof InputElement ? active : null);
        this.contextKeys.set("editorGroupHasEditors", editorCount > 0);
        this.contextKeys.set("editorTabsMultiple", editorCount > 1);
        this.contextKeys.set("findWidgetVisible", this.findController.isVisible());

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
                entries: [item("Save", "workbench.action.files.save"), sep(), item("Exit", "workbench.action.quit")],
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
                    item("Explorer", "workbench.view.explorer"),
                    item("Toggle Primary Side Bar", "workbench.action.toggleSidebarVisibility"),
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
        this.view.setMenuBar(menuBar);
    }

    public showConfirmSaveDialog(
        filename: string,
        callbacks: { onSave: () => void; onDontSave: () => void; onCancel: () => void },
    ): void {
        if (!this.confirmDialog) {
            this.confirmDialog = new ConfirmSaveDialogElement(filename);
            this.confirmDialog.applyTheme(this.themeService.theme);
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

    public showAboutDialog(): void {
        if (!this.aboutDialog) {
            this.aboutDialog = new AboutDialogElement();
            this.aboutDialog.applyTheme(this.themeService.theme);
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
                label: "Delete",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    this.commands.execute("fileOperations.deleteFile", filePath);
                },
            },
        ];

        const menu = new PopupMenuElement(entries);
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
                    /* v8 ignore start -- defensive: a replaced session is disposed (which does not fire onClose), so when onClose runs it is always the current session */
                    if (this.fileTreeContextMenuSession === session) {
                        /* v8 ignore stop */
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
        session.dispose();
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
                editor.save();
                if (rest.length === 0) {
                    this.doQuit(accessor);
                } else {
                    this.showQuitConfirmDialogSequential(rest, accessor);
                }
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
