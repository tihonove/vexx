import { Disposable } from "../Common/Disposable.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";
import { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";
import { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";

import { FileTreeDataProvider, type FileTreeNode } from "./FileTreeDataProvider.ts";
import type { IController } from "./IController.ts";

export class FileTreeController extends Disposable implements IController {
    public readonly view: TUIElement;
    private provider: FileTreeDataProvider;
    private tree: TreeViewElement<FileTreeNode>;

    public constructor(rootPath: string) {
        super();
        this.provider = this.register(new FileTreeDataProvider(rootPath));
        this.tree = new TreeViewElement(this.provider);
        this.view = new ScrollBarDecorator(this.tree);
    }

    public mount(): void {
        this.tree.onExpandedChanged = (node, expanded) => {
            if (expanded) {
                this.provider.watchDirectory(node.path);
            } else {
                this.provider.unwatchDirectory(node.path);
            }
        };

        this.tree.onActivate = (node) => {
            if (!node.isDirectory) {
                console.log("Activate file:", node.path);
            }
        };
    }

    public async activate(): Promise<void> {
        await this.tree.refresh();
    }

    public focus(): void {
        this.tree.focus();
    }
}
