import { BoxConstraints, Offset, Point, Size } from "../../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { ContextMenuLayer } from "./ContextMenuLayer.ts";
import type { MenuBarElement } from "./MenuBarElement.ts";

export class BodyElement extends TUIElement {
    public title = "";
    public content: TUIElement | null = null;
    public menuBar: MenuBarElement | null = null;
    public readonly contextMenuLayer: ContextMenuLayer;

    public constructor() {
        super();
        // BodyElement is the root, so mark it as such
        this.setAsRoot();

        this.contextMenuLayer = new ContextMenuLayer();
        this.contextMenuLayer.setParent(this);
    }

    public setContent(element: TUIElement): void {
        this.content = element;
        this.content.setParent(this);
    }

    public setMenuBar(menuBar: MenuBarElement): void {
        this.menuBar = menuBar;
        this.menuBar.setParent(this);
    }

    public override getChildren(): readonly TUIElement[] {
        const children: TUIElement[] = [];
        if (this.menuBar) children.push(this.menuBar);
        if (this.content) children.push(this.content);
        children.push(this.contextMenuLayer);
        return children;
    }

    public performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);
        const menuBarHeight = this.menuBar ? 1 : 0;

        if (this.menuBar) {
            this.menuBar.localPosition = new Offset(0, 0);
            this.menuBar.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);
            this.menuBar.performLayout(BoxConstraints.tight(containerSize));
        }

        if (this.content) {
            const contentSize = new Size(containerSize.width, Math.max(0, containerSize.height - menuBarHeight));
            this.content.localPosition = new Offset(0, menuBarHeight);
            this.content.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y + menuBarHeight);
            this.content.performLayout(BoxConstraints.tight(contentSize));
        }

        this.contextMenuLayer.localPosition = new Offset(0, 0);
        this.contextMenuLayer.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);
        this.contextMenuLayer.performLayout(BoxConstraints.tight(containerSize));

        return containerSize;
    }

    public render(context: RenderContext) {
        // Title (legacy behaviour)
        for (let y = 0; y < this.title.length; y++) {
            context.canvas.setCell(new Point(0 + y, 0), { char: this.title[y] });
        }

        // Content layer
        if (this.content) {
            const contentOffset = new Offset(this.content.localPosition.dx, this.content.localPosition.dy);
            this.content.render(context.withOffset(contentOffset));
        }

        // Menu bar — rendered after content so popup overlays content
        if (this.menuBar) {
            const menuBarOffset = new Offset(this.menuBar.localPosition.dx, this.menuBar.localPosition.dy);
            this.menuBar.render(context.withOffset(menuBarOffset));
        }

        // Context menu layer — rendered on top
        this.contextMenuLayer.render(context);
    }
}
