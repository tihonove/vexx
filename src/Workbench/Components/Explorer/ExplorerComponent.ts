import { token } from "../../../Common/DiContainer.ts";
import type { IFileClipboard } from "../../../Common/IFileClipboard.ts";
import type { ThemeService } from "../../../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../../../Theme/ThemeTokens.ts";
import type { TUIElement } from "../../../TUIDom/TUIElement.ts";
import type { BodyElement } from "../../../TUIDom/Widgets/BodyElement.ts";
import type { OverlaySessionHandle } from "../../../TUIDom/Widgets/OverlayLayer.ts";
import { PaddingContainerElement } from "../../../TUIDom/Widgets/PaddingContainerElement.ts";
import type { MenuEntry } from "../../../TUIDom/Widgets/PopupMenuElement.ts";
import { PopupMenuElement } from "../../../TUIDom/Widgets/PopupMenuElement.ts";
import { ScrollBarDecorator } from "../../../TUIDom/Widgets/ScrollContainerElement.ts";
import { TitledPanelElement } from "../../../TUIDom/Widgets/TitledPanelElement.ts";
import { TreeViewElement } from "../../../TUIDom/Widgets/TreeViewElement.ts";
import { ThemedComponent } from "../../Component.ts";
import type { CommandRegistry } from "../../Services/CommandRegistry.ts";
import { CommandRegistryDIToken } from "../../Services/CommandRegistry.ts";
import { FileClipboardDIToken } from "../../Services/CoreTokens.ts";
import type { ExplorerService } from "../../Services/ExplorerService.ts";
import { ExplorerServiceDIToken } from "../../Services/ExplorerService.ts";
import type { FileTreeNode } from "../../Services/FileTreeDataProvider.ts";
import { getFileTreeStyles, getMenuStyles, getScrollBarStyles } from "../../Styles/defaultStyles.ts";

export const ExplorerComponentDIToken = token<ExplorerComponent>("ExplorerComponent");

interface ExplorerViewParts {
    readonly tree: TreeViewElement<FileTreeNode>;
    readonly scrollBars: ScrollBarDecorator;
    readonly root: TitledPanelElement;
}

/**
 * Компонент Explorer'а (сайдбар с деревом файлов): владеет `TreeViewElement`
 * поверх провайдера {@link ExplorerService} (обёрнутым в скроллбар и рамку
 * EXPLORER), перестраивает дерево по смене корня воркспейса и регистрирует его
 * в сервисе (шов `IExplorerView`). Активация файла уходит в команду
 * `workbench.openFile`; правый клик/Shift+F10 открывают контекстное меню
 * (PopupMenu в overlay-слое хоста — его прикрепляет владелец корневой view
 * через {@link attachHost}), пункты которого исполняют команды
 * `explorer.*`/`fileOperations.*`.
 */
export class ExplorerComponent extends ThemedComponent {
    public static dependencies = [
        ExplorerServiceDIToken,
        CommandRegistryDIToken,
        FileClipboardDIToken,
        ThemeServiceDIToken,
    ] as const;

    private parts: ExplorerViewParts | null = null;
    private host: BodyElement | null = null;
    private contextMenuSession: OverlaySessionHandle | null = null;

    public constructor(
        private readonly explorerService: ExplorerService,
        private readonly commands: CommandRegistry,
        private readonly fileClipboard: IFileClipboard,
        themeService: ThemeService,
    ) {
        super(themeService);
        this.register(
            explorerService.onDidChangeRoot(() => {
                this.rebuild();
            }),
        );
        if (explorerService.provider) {
            this.rebuild();
        }
        this.initStyles();
    }

    /** Корневой контрол. До первого setRootPath сервиса дерева ещё нет (как и раньше у контроллера). */
    public get view(): TUIElement {
        return this.parts?.root as TUIElement;
    }

    /**
     * Прикрепляет хост с overlay-слоем (корневую BodyElement-view приложения) —
     * в нём открываются popup-сессии контекстного меню. Зовёт владелец корневой
     * view (WorkbenchComponent) после её постройки, как у DialogService.
     */
    public attachHost(host: BodyElement): void {
        this.host = host;
    }

    /**
     * Открывает контекстное меню дерева с клавиатуры (Shift+F10), заякорив его на
     * выделенной строке. Переиспользует ровно тот же путь, что и правый клик.
     * No-op, если дерево пусто или выбор отсутствует.
     */
    public openContextMenuAtSelection(): void {
        if (!this.parts) return;
        const node = this.parts.tree.getSelectedNode();
        const anchor = this.parts.tree.getSelectedRowGlobalPosition();
        if (!node || !anchor) return;
        this.showContextMenu(node.path, anchor.x, anchor.y);
    }

    /** Пересоздаёт дерево под новый провайдер сервиса и регистрирует его как view сервиса. */
    private rebuild(): void {
        const provider = this.explorerService.provider;
        /* v8 ignore start -- defensive: onDidChangeRoot only fires from setRootPath, where the provider is (re)created */
        if (!provider) return;
        /* v8 ignore stop */
        const tree = new TreeViewElement<FileTreeNode>(provider);
        const scrollBars = new ScrollBarDecorator(tree);
        const root = new TitledPanelElement("  EXPLORER", new PaddingContainerElement(scrollBars, { left: 1 }));
        root.id = "explorer";
        this.parts = { tree, scrollBars, root };

        tree.onExpandedChanged = (node, expanded) => {
            if (expanded) {
                provider.watchDirectory(node.path);
            } else {
                provider.unwatchDirectory(node.path);
            }
        };
        tree.onActivate = (node) => {
            if (!node.isDirectory) {
                this.commands.execute("workbench.openFile", node.path);
            }
        };
        tree.onContextMenu = (node, screenX, screenY) => {
            this.showContextMenu(node.path, screenX, screenY);
        };

        this.explorerService.attachView(tree);
        this.updateStyles();
    }

    private showContextMenu(filePath: string, screenX: number, screenY: number): void {
        if (!this.host) return;
        const host = this.host;
        this.hideContextMenu();

        const entries: MenuEntry[] = [
            {
                label: "New File...",
                onSelect: () => {
                    this.hideContextMenu();
                    this.commands.execute("explorer.newFile", filePath);
                },
            },
            {
                label: "New Folder...",
                onSelect: () => {
                    this.hideContextMenu();
                    this.commands.execute("explorer.newFolder", filePath);
                },
            },
            { type: "separator" },
            {
                label: "Copy",
                shortcut: "Ctrl+C",
                onSelect: () => {
                    this.hideContextMenu();
                    this.commands.execute("fileOperations.copy");
                },
            },
            {
                label: "Cut",
                shortcut: "Ctrl+X",
                onSelect: () => {
                    this.hideContextMenu();
                    this.commands.execute("fileOperations.cut");
                },
            },
        ];
        if (this.fileClipboard.read() !== null) {
            entries.push({
                label: "Paste",
                shortcut: "Ctrl+V",
                onSelect: () => {
                    this.hideContextMenu();
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
                    this.hideContextMenu();
                    this.commands.execute("fileOperations.copyPath", filePath);
                },
            },
            {
                label: "Copy Relative Path",
                shortcut: "Ctrl+K Ctrl+Shift+C",
                onSelect: () => {
                    this.hideContextMenu();
                    this.commands.execute("fileOperations.copyRelativePath", filePath);
                },
            },
            { type: "separator" },
            {
                label: "Rename...",
                shortcut: "F2",
                onSelect: () => {
                    this.hideContextMenu();
                    this.commands.execute("fileOperations.rename", filePath);
                },
            },
            {
                label: "Delete",
                onSelect: () => {
                    this.hideContextMenu();
                    this.commands.execute("fileOperations.deleteFile", filePath);
                },
            },
            { type: "separator" },
            {
                // Re-read the directory contents from disk (external changes the
                // live watcher might have missed — network shares, ignored paths).
                label: "Refresh Explorer",
                onSelect: () => {
                    this.hideContextMenu();
                    this.commands.execute("workbench.files.action.refreshFilesExplorer");
                },
            },
        );

        const menu = new PopupMenuElement(entries);
        menu.setStyles(getMenuStyles(this.theme));
        menu.tabIndex = 0;

        let session: OverlaySessionHandle | null = null;
        session = host.overlayLayer.openPopupSession(
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
                    // Через hideContextMenu поле уже занулено до close() — не трогаем
                    // (там может быть уже открыта следующая сессия).
                    if (this.contextMenuSession === session) {
                        this.contextMenuSession = null;
                    }
                },
            },
        );

        menu.onClose = () => {
            session.close();
        };

        this.contextMenuSession = session;
    }

    private hideContextMenu(): void {
        if (!this.contextMenuSession) return;
        const session = this.contextMenuSession;
        this.contextMenuSession = null;
        // Именно close(), не dispose(): close восстанавливает сохранённый фокус (restoreFocus),
        // а disposeOnClose доведёт teardown до конца.
        session.close();
    }

    protected updateStyles(): void {
        // Темы могут приходить и до корня воркспейса — дерева тогда ещё нет.
        if (!this.parts) return;
        this.parts.tree.setStyles(getFileTreeStyles(this.theme));
        this.parts.root.style = {
            fg: this.theme.getRequiredColor("sideBar.foreground"),
            bg: this.theme.getRequiredColor("sideBar.background"),
        };
        this.parts.scrollBars.setStyles(getScrollBarStyles(this.theme, "sideBar.background"));
    }
}
