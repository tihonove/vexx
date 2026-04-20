import { Disposable } from "../Common/Disposable.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";
import { PaddingContainerElement } from "../TUIDom/Widgets/PaddingContainerElement.ts";
import { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";
import { TitledPanelElement } from "../TUIDom/Widgets/TitledPanelElement.ts";
import { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";

import { FileTreeDataProvider, type FileTreeNode } from "./FileTreeDataProvider.ts";
import type { IController } from "./IController.ts";

export class FileTreeController extends Disposable implements IController {
    public view!: TUIElement;
    public onFileActivate: ((filePath: string) => void) | null = null;
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
        this.tree = new TreeViewElement(this.provider);
        this.view = new TitledPanelElement(
            "  EXPLORER",
            new PaddingContainerElement(new ScrollBarDecorator(this.tree), { left: 1 }),
        );
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

    public focus(): void {
        this.tree?.focus();
    }

    private wireTreeEvents(): void {
        if (!this.tree || !this.provider) return;
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
    }

    private applyTheme(theme: WorkbenchTheme): void {
        if (!this.tree) return;
        this.tree.activeSelectionBg = theme.getColorOrDefault("list.activeSelectionBackground", packRgb(4, 57, 94));
        this.tree.activeSelectionFg = theme.getColorOrDefault("list.activeSelectionForeground", packRgb(255, 255, 255));
        this.tree.inactiveSelectionBg = theme.getColorOrDefault(
            "list.inactiveSelectionBackground",
            packRgb(55, 55, 61),
        );
        this.tree.inactiveSelectionFg = theme.getColorOrDefault(
            "list.inactiveSelectionForeground",
            packRgb(204, 204, 204),
        );
        this.tree.hoverBg = theme.getColor("list.hoverBackground");
        this.tree.hoverFg = theme.getColor("list.hoverForeground");

        const sidebarBg = theme.getColor("sideBar.background");
        const sidebarFg = theme.getColor("sideBar.foreground");
        this.view.style = {
            ...(sidebarFg !== undefined ? { fg: sidebarFg } : {}),
            ...(sidebarBg !== undefined ? { bg: sidebarBg } : {}),
        };
    }
}
