import { Disposable } from "../Common/Disposable.ts";
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

    public constructor() {
        super();
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
}
