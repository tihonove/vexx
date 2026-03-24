import { RenderContext, TUIElement } from "./TUIElement.ts";
import { ContextMenuLayer } from "./ContextMenuLayer.ts";
import { BoxConstraints, Offset, Point, Size } from "../Common/GeometryPromitives.ts";
import type { TUIEvent } from "../TerminalBackend/KeyEvent.ts";

export class BodyElement extends TUIElement {
    public title = "";
    public content: TUIElement | null = null;
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

    public performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);

        if (this.content) {
            this.content.localPosition = new Offset(0, 0);
            this.content.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);
            this.content.performLayout(BoxConstraints.tight(containerSize));
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

        // Context menu layer — rendered on top
        this.contextMenuLayer.render(context);
    }

    public override emit(event: TUIEvent): void {
        // Own listeners first (e.g. keypress on body.title)
        super.emit(event);

        // If overlay has visible items, route keyboard events there exclusively
        if (this.contextMenuLayer.hasVisibleItems()) {
            this.contextMenuLayer.emit(event);
        } else if (this.content) {
            this.content.emit(event);
        }
    }
}
