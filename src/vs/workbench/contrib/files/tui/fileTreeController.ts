import * as path from "node:path";

import { Disposable } from "../../../../base/common/lifecycle.ts";
import { token } from "../../../../platform/instantiation/common/instantiation.ts";
import type { ThemeService } from "../../../services/themes/common/themeService.ts";
import type { WorkbenchTheme } from "../../../../platform/theme/common/workbenchTheme.ts";
import type { TUIElement } from "../../../../base/tui/tuiElement.ts";
import { PaddingContainerElement } from "../../../../base/tui/ui/layout/paddingContainerElement.ts";
import { ScrollBarDecorator } from "../../../../base/tui/ui/scrollbar/scrollContainerElement.ts";
import { TitledPanelElement } from "../../../tui/parts/panel/titledPanelElement.ts";
import { TreeViewElement } from "../../../../base/tui/ui/tree/treeViewElement.ts";

import { FileTreeDataProvider, type FileTreeNode } from "./fileTreeDataProvider.ts";
import type { IController } from "../../../tui/controller.ts";

export const FileTreeControllerDIToken = token<FileTreeController>("FileTreeController");

export class FileTreeController extends Disposable implements IController {
    public view!: TUIElement;
    public onFileActivate: ((filePath: string) => void) | null = null;
    public onFileContextMenu: ((node: FileTreeNode, screenX: number, screenY: number) => void) | null = null;
    // Ошибка файлового watcher'а дерева (например ENOSPC — исчерпан лимит inotify).
    // Пробрасывается из провайдера наверх, где её логируют (см. AppController).
    public onWatchError: ((dirPath: string, error: Error) => void) | null = null;
    private provider: FileTreeDataProvider | null = null;
    private tree: TreeViewElement<FileTreeNode> | null = null;
    private rootPath: string | null = null;
    private mounted = false;
    private themeService: ThemeService | null = null;

    public constructor(themeService?: ThemeService) {
        super();
        if (themeService) {
            this.themeService = themeService;
            this.register(
                themeService.onThemeChange((theme) => {
                    this.applyTheme(theme);
                }),
            );
        }
    }

    public setRootPath(rootPath: string): void {
        this.rootPath = rootPath;
        this.provider = this.register(new FileTreeDataProvider(rootPath));
        this.provider.onWatchError = (dirPath, error) => {
            this.onWatchError?.(dirPath, error);
        };
        this.tree = new TreeViewElement(this.provider);
        this.view = new TitledPanelElement(
            "  EXPLORER",
            new PaddingContainerElement(new ScrollBarDecorator(this.tree), { left: 1 }),
        );
        if (this.themeService) {
            this.applyTheme(this.themeService.theme);
        }
        if (this.mounted) {
            this.wireTreeEvents();
        }
    }

    public getRootPath(): string | null {
        return this.rootPath;
    }

    public hasRootPath(): boolean {
        return this.rootPath !== null;
    }

    public mount(): void {
        this.mounted = true;
        if (this.tree) {
            this.wireTreeEvents();
        }
    }

    public async activate(): Promise<void> {
        if (this.tree) {
            await this.tree.refresh();
        }
    }

    public async refresh(): Promise<void> {
        if (this.tree) {
            await this.tree.refresh();
        }
    }

    public focus(): void {
        this.tree?.focus();
    }

    /**
     * Раскрывает дерево до файла `filePath` и выделяет его. Путь вне корня игнорируется.
     * Возвращает `true`, если файл лежит внутри корня (и попытка раскрытия выполнена).
     */
    public async revealPath(filePath: string): Promise<boolean> {
        if (!this.tree || this.rootPath === null) return false;
        const relative = path.relative(this.rootPath, filePath);
        /* v8 ignore next -- isAbsolute(relative) is Windows-only (cross-drive paths); unreachable on POSIX CI */
        if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
            return false;
        }
        const segments = relative.split(path.sep);
        const chain: FileTreeNode[] = [];
        let current = this.rootPath;
        for (let i = 0; i < segments.length; i++) {
            current = path.join(current, segments[i]);
            const isLast = i === segments.length - 1;
            chain.push({ name: segments[i], path: current, isDirectory: !isLast });
        }
        await this.tree.reveal(chain);
        return true;
    }

    /** Пути выбранных узлов (множественный выбор либо узел под курсором). */
    public getSelectedPaths(): string[] {
        return this.tree?.getSelectedNodes().map((node) => node.path) ?? [];
    }

    /**
     * Каталог, в который должна выполняться вставка: сам узел под курсором, если это
     * папка, иначе — его родитель. При пустом дереве — корень.
     */
    public getPasteTargetDir(): string | null {
        const node = this.tree?.getSelectedNode() ?? null;
        if (!node) return this.rootPath;
        return node.isDirectory ? node.path : path.dirname(node.path);
    }

    /**
     * Проставляет статус-декорации файлов (цвет имени + буква-бейдж) по абсолютному
     * пути и перерисовывает дерево. Цвета приходят уже резолвнутыми — applyTheme тут
     * ни при чём. Пустой список снимает все декорации.
     */
    public setFileDecorations(entries: readonly { path: string; color?: number; badge?: string }[]): void {
        if (!this.provider || !this.tree) return;
        const map = new Map<string, { color?: number; badge?: string }>();
        for (const entry of entries) {
            map.set(entry.path, { color: entry.color, badge: entry.badge });
        }
        this.provider.setGitStatus(map);
        void this.tree.refresh();
    }

    /** Подсвечивает «вырезанные» пути приглушённым цветом (или снимает подсветку). */
    public setCutPaths(paths: string[]): void {
        if (!this.tree) return;
        if (paths.length === 0) {
            this.tree.clearCutKeys();
        } else {
            this.tree.setCutKeys(new Set(paths));
        }
    }

    private wireTreeEvents(): void {
        /* v8 ignore start -- defensive: both callers (mount/setRootPath) only invoke this once tree+provider exist */
        if (!this.tree || !this.provider) return;
        /* v8 ignore stop */
        const provider = this.provider;
        this.tree.onExpandedChanged = (node, expanded) => {
            if (expanded) {
                provider.watchDirectory(node.path);
            } else {
                provider.unwatchDirectory(node.path);
            }
        };

        this.tree.onActivate = (node) => {
            if (!node.isDirectory) {
                this.onFileActivate?.(node.path);
            }
        };

        this.tree.onContextMenu = (node, screenX, screenY) => {
            this.onFileContextMenu?.(node, screenX, screenY);
        };
    }

    private applyTheme(theme: WorkbenchTheme): void {
        if (!this.tree) return;
        this.tree.activeSelectionBg = theme.getRequiredColor("list.activeSelectionBackground");
        this.tree.activeSelectionFg = theme.getRequiredColor("list.activeSelectionForeground");
        this.tree.inactiveSelectionBg = theme.getRequiredColor("list.inactiveSelectionBackground");
        this.tree.inactiveSelectionFg = theme.getRequiredColor("list.inactiveSelectionForeground");
        this.tree.hoverBg = theme.getRequiredColor("list.hoverBackground");
        this.tree.hoverFg = theme.getColor("list.hoverForeground");
        this.tree.cutFg = theme.getRequiredColor("list.deemphasizedForeground");
        this.tree.symlinkFg = theme.getRequiredColor("list.deemphasizedForeground");

        this.view.style = {
            fg: theme.getRequiredColor("sideBar.foreground"),
            bg: theme.getRequiredColor("sideBar.background"),
        };
    }
}
