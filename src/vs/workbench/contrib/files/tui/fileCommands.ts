import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { Disposable } from "../../../../base/common/lifecycle.ts";
import type { BodyElement } from "../../../../base/tui/bodyElement.ts";
import type { MenuEntry } from "../../../../base/tui/ui/menu/popupMenuElement.ts";
import { PopupMenuElement } from "../../../../base/tui/ui/menu/popupMenuElement.ts";
import type { OverlaySessionHandle } from "../../../../base/tui/ui/contextview/overlayLayer.ts";
import { registerAction } from "../../../../platform/commands/common/commandAction.ts";
import type { CommandRegistry } from "../../../../platform/commands/common/commands.ts";
import type { IClipboard } from "../../../../platform/clipboard/common/clipboardService.ts";
import type { IFileClipboard } from "../../../../platform/clipboard/common/fileClipboard.ts";
import type { IConfigurationService } from "../../../../platform/configuration/common/configuration.ts";
import type { ServiceAccessor, Token } from "../../../../platform/instantiation/common/instantiation.ts";
import type { KeybindingRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import { parseKeybinding } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import type { ILogger } from "../../../../platform/log/common/logger.ts";
import type { UndoRedoService } from "../../../../platform/undoRedo/common/undoRedoService.ts";
import { WORKSPACE_UNDO_CONTEXT } from "../../../../platform/undoRedo/common/undoRedoService.ts";
import type { QuickInputController } from "../../../../platform/quickinput/tui/quickInputController.ts";
import type { DialogService } from "../../../services/dialogs/tui/dialogService.ts";
import type { ThemeService } from "../../../services/themes/common/themeService.ts";
import type { EditorGroupController } from "../../../tui/parts/editor/editorGroupController.ts";
import type { WorkspaceEditService } from "../../bulkEdit/node/workspaceEditService.ts";
import type { FileTreeController } from "./fileTreeController.ts";
import { fileOpenAction, fileOpenFolderAction, fileSaveAsAction } from "./fileActions.ts";
import { fileDeleteAction } from "./fileTreeActions.ts";
import {
    buildPasteEdits,
    fileCopyAction,
    fileCopyPathAction,
    fileCopyRelativePathAction,
    fileCutAction,
    filePasteAction,
} from "./fileTreeClipboardActions.ts";
import { explorerNewFileAction, explorerNewFolderAction } from "./fileTreeCreateActions.ts";

interface IFileCommandsDeps {
    readonly commands: CommandRegistry;
    readonly keybindings: KeybindingRegistry;
    readonly accessor: ServiceAccessor;
    readonly view: BodyElement;
    readonly fileTree: FileTreeController;
    readonly fileClipboard: IFileClipboard;
    readonly workspaceEdits: WorkspaceEditService;
    readonly undoRedo: UndoRedoService;
    readonly configuration: IConfigurationService;
    readonly editorGroup: EditorGroupController;
    readonly quickInput: QuickInputController;
    readonly dialogs: DialogService;
    readonly themeService: ThemeService;
    readonly logger: ILogger;
    readonly clipboardToken: Token<IClipboard>;
    /** Открыть файл через воркбенч (обновляет context keys + статус-бар). */
    openFile(absolutePath: string): void;
    /** Сменить корень воркспейса (дерево, стор состояния, поисковый индекс). */
    setWorkspaceFolder(dirPath: string): void;
    /** После сохранения — обновить статус-бар (модифицированность вкладки). */
    onDidSave(): void;
    /** После Save As — обновить context keys + статус-бар (сменился путь). */
    onDidSaveAs(): void;
}

/**
 * Файловые команды воркбенча (аналог vscode `contrib/files/browser/fileActions`
 * + `fileCommands`): операции проводника (create/delete/copy/cut/paste,
 * copy-path, undo/redo файловых операций, контекстное меню дерева) и файловые
 * флоу редактора (Save с защитой от конфликтов, Save As, Open File/Folder).
 * Регистрирует все свои команды в конструкторе; воркбенч передаёт хуки для
 * действий, требующих app-уровня (openFile, смена воркспейса, статус-бар).
 */
export class FileCommands extends Disposable {
    private fileTreeContextMenuSession: OverlaySessionHandle | null = null;

    public constructor(private readonly deps: IFileCommandsDeps) {
        super();
        const { commands, keybindings, accessor } = deps;

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
        this.register(
            commands.register(
                "workbench.files.action.refreshFilesExplorer",
                () => {
                    void deps.fileTree.refresh();
                },
                "File: Refresh Explorer",
            ),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                id: "workbench.files.action.showActiveFileInExplorer",
                title: "File: Reveal Active File in Explorer",
                run: () => {
                    const filePath = deps.editorGroup.getActiveEditor()?.absoluteFilePath;
                    if (!filePath) return;
                    this.onRevealRequested();
                    deps.fileTree.focus();
                    void deps.fileTree.revealPath(filePath);
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileDeleteAction,
                run: (_a, ...args) => {
                    const filePath = (args[0] as string | undefined) ?? deps.fileTree.getSelectedPaths()[0];
                    if (filePath) this.requestDeleteFile(filePath);
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileCopyAction,
                run: () => {
                    const paths = deps.fileTree.getSelectedPaths();
                    if (paths.length > 0) deps.fileClipboard.write(paths, "copy");
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileCutAction,
                run: () => {
                    const paths = deps.fileTree.getSelectedPaths();
                    if (paths.length > 0) deps.fileClipboard.write(paths, "cut");
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
                    const targetDir = deps.fileTree.getPasteTargetDir();
                    if (!targetDir) return;
                    const entry = deps.fileClipboard.read();
                    if (!entry) return;
                    deps.workspaceEdits.applyFileEdits(
                        buildPasteEdits(entry, targetDir),
                        entry.mode === "cut" ? "Move" : "Paste",
                    );
                    if (entry.mode === "cut") deps.fileClipboard.clear();
                    void deps.fileTree.refresh();
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileCopyPathAction,
                run: (runAccessor, ...args) => {
                    const filePath = (args[0] as string | undefined) ?? deps.fileTree.getSelectedPaths()[0];
                    if (filePath) void runAccessor.get(deps.clipboardToken).writeText(filePath);
                },
            }),
        );
        this.register(
            registerAction(commands, keybindings, accessor, {
                ...fileCopyRelativePathAction,
                run: (runAccessor, ...args) => {
                    const filePath = (args[0] as string | undefined) ?? deps.fileTree.getSelectedPaths()[0];
                    if (!filePath) return;
                    const root = deps.fileTree.getRootPath();
                    const relative = root ? path.relative(root, filePath) : filePath;
                    void runAccessor.get(deps.clipboardToken).writeText(relative);
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
                    void deps.undoRedo.redo(WORKSPACE_UNDO_CONTEXT).then((ok) => {
                        if (ok) void deps.fileTree.refresh();
                    });
                },
            }),
        );
    }

    /** Хук: перед reveal показать сайдбар (переопределяется воркбенчем). */
    /* v8 ignore start -- дефолт-заглушка: воркбенч всегда переопределяет хук сразу после создания */
    public onRevealRequested: () => void = () => {};
    /* v8 ignore stop */

    /**
     * Автоматически подсвечивает активный файл в дереве при смене активного редактора,
     * если включена настройка `explorer.autoReveal`. Фокус не отбирается у редактора —
     * меняется только выделение/скролл дерева (в отличие от явной команды reveal).
     */
    public autoRevealActiveFile(): void {
        const autoReveal = this.deps.configuration.get<boolean>("explorer.autoReveal", true) ?? true;
        if (!autoReveal) return;
        const filePath = this.deps.editorGroup.getActiveEditor()?.absoluteFilePath;
        if (!filePath) return;
        void this.deps.fileTree.revealPath(filePath);
    }

    /** Удаление файла: подтверждение (всегда — если безвозвратно) + запись в историю отмены. */
    private requestDeleteFile(filePath: string): void {
        const willTrash = this.deps.workspaceEdits.willMoveToTrash();
        const confirmDelete = this.deps.configuration.get<boolean>("explorer.confirmDelete", true) ?? true;
        const name = path.basename(filePath);

        const doDelete = (): void => {
            this.deps.workspaceEdits.applyFileEdits([{ kind: "delete", from: filePath }], "Delete");
            void this.deps.fileTree.refresh();
        };

        // Безвозвратное удаление подтверждаем всегда (необратимо); удаление в корзину — по настройке.
        if (willTrash && !confirmDelete) {
            doDelete();
            return;
        }
        this.deps.dialogs.showConfirmDialog(
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
        const element = this.deps.undoRedo.peekUndo(WORKSPACE_UNDO_CONTEXT);
        if (!element) return;
        const confirmUndo = this.deps.configuration.get<boolean>("explorer.confirmUndo", true) ?? true;

        const doUndo = (): void => {
            void this.deps.undoRedo.undo(WORKSPACE_UNDO_CONTEXT).then((ok) => {
                /* v8 ignore start -- defensive: peekUndo above gates on a non-empty stack, and undo() pops synchronously, so it cannot come back empty */
                if (ok) void this.deps.fileTree.refresh();
                /* v8 ignore stop */
            });
        };

        if (element.confirmBeforeUndo && confirmUndo) {
            this.deps.dialogs.showConfirmDialog(
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

    /**
     * Explicit Save (Ctrl+S / menu). Saves the active editor; if the file was
     * modified on disk by another process since it was opened, the write is
     * blocked (to avoid clobbering the parallel changes) and an Overwrite/Cancel
     * dialog is shown instead — mirroring VS Code's dirty-write protection.
     */
    private async runSave(): Promise<void> {
        const editor = this.deps.editorGroup.getActiveEditor();
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
            this.deps.dialogs.showConfirmDialog(
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
                            this.deps.onDidSave();
                        });
                    },
                },
            );
            return;
        }
        this.deps.onDidSave();
    }

    /**
     * Save As flow: prompt for a target path (InputBox), confirm overwrite if a
     * different file already exists, then write via EditorController.saveAs.
     */
    private async runSaveAs(): Promise<void> {
        const editor = this.deps.editorGroup.getActiveEditor();
        if (!editor) return;

        // Безымянный буфер (Ctrl+N) не имеет пути — стартуем от cwd/untitled.txt.
        const seed = editor.absoluteFilePath ?? path.join(process.cwd(), editor.fileName ?? "untitled.txt");
        const target = await this.deps.quickInput.input({
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
                this.deps.onDidSaveAs();
            } catch (error) {
                /* v8 ignore start -- defensive: surfaces a filesystem write failure (permissions/disk); not reproducible in tests */
                this.deps.logger.error("Save As failed", { path: resolved, error: String(error) });
                /* v8 ignore stop */
            }
        };

        // Overwriting a *different* existing file → confirm first.
        if (resolved !== editor.absoluteFilePath && fs.existsSync(resolved)) {
            this.deps.dialogs.showConfirmDialog(
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
     * creates it via the undoable WorkspaceEditService, refreshes and
     * reveals it in the tree, and — for files — opens it in the editor.
     */
    private async runCreate(kind: "file" | "folder", explorerPath?: string): Promise<void> {
        const targetDir = explorerPath
            ? fs.statSync(explorerPath).isDirectory()
                ? explorerPath
                : path.dirname(explorerPath)
            : this.deps.fileTree.getPasteTargetDir();
        if (!targetDir) return;

        const name = await this.deps.quickInput.input({
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
        this.deps.workspaceEdits.applyFileEdits(
            [{ kind: "create", to: resolved, directory: kind === "folder" }],
            kind === "file" ? "New File" : "New Folder",
        );
        await this.deps.fileTree.refresh();
        await this.deps.fileTree.revealPath(resolved);
        if (kind === "file") {
            this.deps.openFile(resolved);
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
        return this.deps.fileTree.getRootPath() ?? process.cwd();
    }

    /**
     * Open File flow: prompt for a path (InputBox), validate it points at an
     * existing file, then open it in the active editor group. The prompt opens
     * empty; a relative path is resolved against the workspace root.
     */
    private async runOpenFile(): Promise<void> {
        const target = await this.deps.quickInput.input({
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
        if (resolved) this.deps.openFile(resolved);
    }

    /**
     * Open Folder flow: prompt for a path (InputBox), validate it points at an
     * existing directory, then swap the workspace root to it (file tree, side
     * panel and the Quick Open search index all re-target the new folder).
     */
    private async runOpenFolder(): Promise<void> {
        const target = await this.deps.quickInput.input({
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
        if (resolved) this.deps.setWorkspaceFolder(resolved);
    }

    public showFileTreeContextMenu(filePath: string, screenX: number, screenY: number): void {
        this.hideFileTreeContextMenu();
        const { commands } = this.deps;

        const entries: MenuEntry[] = [
            {
                label: "New File...",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    commands.execute("explorer.newFile", filePath);
                },
            },
            {
                label: "New Folder...",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    commands.execute("explorer.newFolder", filePath);
                },
            },
            { type: "separator" },
            {
                label: "Copy",
                shortcut: "Ctrl+C",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    commands.execute("fileOperations.copy");
                },
            },
            {
                label: "Cut",
                shortcut: "Ctrl+X",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    commands.execute("fileOperations.cut");
                },
            },
        ];
        if (this.deps.fileClipboard.read() !== null) {
            entries.push({
                label: "Paste",
                shortcut: "Ctrl+V",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    commands.execute("fileOperations.paste");
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
                    commands.execute("fileOperations.copyPath", filePath);
                },
            },
            {
                label: "Copy Relative Path",
                shortcut: "Ctrl+K Ctrl+Shift+C",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    commands.execute("fileOperations.copyRelativePath", filePath);
                },
            },
            { type: "separator" },
            {
                label: "Delete",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    commands.execute("fileOperations.deleteFile", filePath);
                },
            },
            { type: "separator" },
            {
                // Re-read the directory contents from disk (external changes the
                // live watcher might have missed — network shares, ignored paths).
                label: "Refresh Explorer",
                onSelect: () => {
                    this.hideFileTreeContextMenu();
                    commands.execute("workbench.files.action.refreshFilesExplorer");
                },
            },
        );

        const menu = new PopupMenuElement(entries);
        menu.applyTheme(this.deps.themeService.theme);
        menu.tabIndex = 0;

        let session: OverlaySessionHandle | null = null;
        session = this.deps.view.overlayLayer.openPopupSession(
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
}
