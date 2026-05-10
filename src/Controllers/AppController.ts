import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import { Point } from "../Common/GeometryPromitives.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { TUIFocusEvent } from "../TUIDom/Events/TUIFocusEvent.ts";
import type { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import { ConfirmSaveDialogElement } from "../TUIDom/Widgets/ConfirmSaveDialogElement.tsx";
import { InputElement } from "../TUIDom/Widgets/InputElement.ts";
import type { MenuBarItem } from "../TUIDom/Widgets/MenuBarElement.ts";
import { MenuBarElement } from "../TUIDom/Widgets/MenuBarElement.ts";
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
    scrollLineDownAction,
    scrollLineUpAction,
    cursorRightSelectAction,
    cursorTopAction,
    cursorTopSelectAction,
    cursorUpAction,
    cursorUpSelectAction,
    cursorWordLeftAction,
    cursorWordLeftSelectAction,
    cursorWordRightAction,
    cursorWordRightSelectAction,
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
import { fileSaveAction } from "./Actions/FileActions.ts";
import {
    inputCursorEndAction,
    inputCursorHomeAction,
    inputCursorLeftAction,
    inputCursorRightAction,
    inputCursorWordLeftAction,
    inputCursorWordRightAction,
    inputDeleteLeftAction,
    inputDeleteRightAction,
    inputDeleteWordLeftAction,
    inputDeleteWordRightAction,
} from "./Actions/InputActions.ts";
import { listFocusPageDownAction, listFocusPageUpAction } from "./Actions/ListActions.ts";
import { closeActiveEditorAction, nextEditorInGroupAction, previousEditorInGroupAction } from "./Actions/TabActions.ts";
import { quickOpenAction, showCommandsAction } from "./Actions/QuickOpenActions.ts";
import { registerAction } from "./CommandAction.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import type { ContextKeyService } from "./ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import { ServiceAccessorDIToken, TuiApplicationDIToken } from "./CoreTokens.ts";
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { EditorGroupController } from "./EditorGroupController.ts";
import { FileTreeController } from "./FileTreeController.ts";
import { FileSearchService } from "./FileSearchService.ts";
import type { IController } from "./IController.ts";
import { InputWidgetController, InputWidgetControllerDIToken } from "./InputWidgetController.ts";
import type { KeybindingRegistry } from "./KeybindingRegistry.ts";
import { KeybindingRegistryDIToken } from "./KeybindingRegistry.ts";
import { QuickOpenController } from "./QuickOpenController.ts";
import { StatusBarControllerDIToken } from "./StatusBarController.ts";
import { StatusBarController } from "./StatusBarController.ts";

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
    ] as const;
    public readonly view: BodyElement;
    public readonly workbenchLayout: WorkbenchLayoutElement;

    private editorGroupController: EditorGroupController;
    private confirmDialog: ConfirmSaveDialogElement | null = null;
    private savedFocusElement: TUIElement | null = null;
    private fileTreeController: FileTreeController;
    private fileSearchService: FileSearchService;
    private quickOpenController: QuickOpenController;
    private statusBarController: StatusBarController;
    private commands: CommandRegistry;
    private keybindings: KeybindingRegistry;
    private contextKeys: ContextKeyService;
    private inputWidgetController: InputWidgetController;

    public constructor(
        editorGroupController: EditorGroupController,
        commands: CommandRegistry,
        keybindings: KeybindingRegistry,
        accessor: ServiceAccessor,
        statusBarController: StatusBarController,
        themeService: ThemeService,
        contextKeys: ContextKeyService,
        inputWidgetController: InputWidgetController,
    ) {
        super();
        this.editorGroupController = this.register(editorGroupController);
        this.fileTreeController = this.register(new FileTreeController(themeService));
        this.fileSearchService = this.register(new FileSearchService());
        this.quickOpenController = this.register(new QuickOpenController(this.fileSearchService, commands));
        this.statusBarController = this.register(statusBarController);
        this.commands = commands;
        this.keybindings = keybindings;
        this.contextKeys = contextKeys;
        this.inputWidgetController = inputWidgetController;

        this.workbenchLayout = new WorkbenchLayoutElement();
        this.workbenchLayout.setCenterContent(this.editorGroupController.view);

        this.view = new BodyElement();
        this.view.setContent(this.workbenchLayout);
        this.view.setStatusBar(this.statusBarController.view);

        this.quickOpenController.setHostView(this.view);
        this.quickOpenController.onOpenFile = (absolutePath) => {
            this.editorGroupController.openFile(absolutePath);
            this.updateContextKeys();
            this.statusBarController.update();
        };
        this.quickOpenController.onExecuteCommand = (id) => {
            this.commands.execute(id);
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

        this.setupMenu();
        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
    }

    public mount(): void {
        this.view.addEventListener("keydown", this.handleKeyDown);
        this.view.addEventListener("keypress", this.handleKeyPress);
        this.view.addEventListener("focus", this.handleFocusChange, { capture: true });
        this.view.addEventListener("blur", this.handleFocusChange, { capture: true });
        this.editorGroupController.mount();
        this.editorGroupController.onRequestConfirmClose = (index) => {
            const editor = this.editorGroupController.getEditor(index);
            if (!editor) return;
            this.showConfirmSaveDialog(editor.fileName ?? "untitled", {
                onSave: () => {
                    editor.save();
                    this.editorGroupController.closeTab(index);
                },
                onDontSave: () => {
                    this.editorGroupController.closeTab(index);
                },
                onCancel: () => {
                    // noop
                },
            });
        };
        this.fileTreeController.mount();
        this.fileTreeController.onFileActivate = (filePath) => {
            this.editorGroupController.openFile(filePath);
            this.updateContextKeys();
            this.statusBarController.update();
        };
        this.statusBarController.mount();
    }

    public async activate(): Promise<void> {
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
        this.fileSearchService.activate(dirPath);
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
    }

    private handleKeyDown = (event: TUIKeyboardEvent): void => {
        this.updateContextKeys();
        const commandId = this.keybindings.resolve(event, this.contextKeys);
        if (commandId && this.commands.has(commandId)) {
            event.preventDefault();
            this.commands.execute(commandId);
        }
    };

    private handleKeyPress = (): void => {
        this.statusBarController.update();
    };

    private handleFocusChange = (_event: TUIFocusEvent): void => {
        this.updateContextKeys();
    };

    private updateContextKeys(): void {
        const active = this.view.focusManager?.activeElement ?? null;
        const editorCount = this.editorGroupController.editorCount;

        this.contextKeys.set("textInputFocus", active instanceof EditorElement);
        this.contextKeys.set("inputWidgetFocus", active instanceof InputElement);
        this.contextKeys.set("listFocus", active instanceof TreeViewElement);
        this.inputWidgetController.setActive(active instanceof InputElement ? active : null);
        this.contextKeys.set("editorGroupHasEditors", editorCount > 0);
        this.contextKeys.set("editorTabsMultiple", editorCount > 1);
    }

    private setupMenu(): void {
        const menuItems: MenuBarItem[] = [
            {
                label: "File",
                mnemonic: "f",
                entries: [
                    {
                        label: "Save",
                        shortcut: "Ctrl+S",
                        onSelect: () => {
                            this.commands.execute("workbench.action.files.save");
                        },
                    },
                    { type: "separator" },
                    {
                        label: "Exit",
                        shortcut: "Ctrl+Q",
                        onSelect: () => {
                            this.commands.execute("workbench.action.quit");
                        },
                    },
                ],
            },
            {
                label: "Edit",
                mnemonic: "e",
                entries: [
                    {
                        label: "Undo",
                        shortcut: "Ctrl+Z",
                        onSelect: () => {
                            this.commands.execute("undo");
                        },
                    },
                    {
                        label: "Redo",
                        shortcut: "Ctrl+Shift+Z",
                        onSelect: () => {
                            this.commands.execute("redo");
                        },
                    },
                    { type: "separator" },
                    {
                        label: "Cut",
                        shortcut: "Ctrl+X",
                        onSelect: () => {
                            this.commands.execute("editor.action.clipboardCutAction");
                        },
                    },
                    {
                        label: "Copy",
                        shortcut: "Ctrl+C",
                        onSelect: () => {
                            this.commands.execute("editor.action.clipboardCopyAction");
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
                        label: "Select All",
                        shortcut: "Ctrl+A",
                        onSelect: () => {
                            this.commands.execute("editor.action.selectAll");
                        },
                    },
                ],
            },
            {
                label: "Selection",
                mnemonic: "s",
                entries: [
                    {
                        label: "Select All",
                        shortcut: "Ctrl+A",
                        onSelect: () => {
                            this.commands.execute("editor.action.selectAll");
                        },
                    },
                    { type: "separator" },
                    {
                        label: "Expand Selection (Word)",
                        shortcut: "Ctrl+Shift+Right",
                        onSelect: () => {
                            this.commands.execute("cursorWordRightSelect");
                        },
                    },
                ],
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
            this.view.contextMenuLayer.addItem(this.confirmDialog, new Point(0, 0), false);
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
        this.view.contextMenuLayer.setPosition(this.confirmDialog, new Point(px, py));

        this.savedFocusElement = this.view.focusManager?.activeElement ?? null;
        this.view.contextMenuLayer.setVisible(this.confirmDialog, true);
        this.confirmDialog.focusDefault();
    }

    private hideConfirmSaveDialog(): void {
        if (!this.confirmDialog) return;
        this.view.contextMenuLayer.setVisible(this.confirmDialog, false);
        if (this.savedFocusElement) {
            this.view.focusManager?.setFocus(this.savedFocusElement);
            this.savedFocusElement = null;
        }
    }

    private doQuit(accessor: ServiceAccessor): void {
        accessor.get(TuiApplicationDIToken).backend.teardown();
        process.exit(0);
    }

    public requestQuit(accessor: ServiceAccessor): void {
        const modifiedIndices: number[] = [];
        for (let i = 0; i < this.editorGroupController.editorCount; i++) {
            if (this.editorGroupController.getEditor(i)?.isModified) {
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
        this.showConfirmSaveDialog(editor.fileName ?? "untitled", {
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
            onCancel: () => {
                // noop
            },
        });
    }
}
