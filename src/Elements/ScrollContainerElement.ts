import { BoxConstraints, Offset, Point, Size } from "../Common/GeometryPromitives.ts";
import type { TUIEvent } from "../TerminalBackend/KeyEvent.ts";
import type { IScrollable } from "./IScrollable.ts";
import { renderScrollBar } from "./ScrollBarRenderer.ts";
import { RenderContext, TUIElement } from "./TUIElement.ts";

export class ScrollContainerElement extends TUIElement {
    private child: TUIElement & IScrollable;

    public constructor(child: TUIElement & IScrollable) {
        super();
        this.child = child;
        this.child.setParent(this); // Set parent for dirty propagation
    }

    public getChild(): TUIElement & IScrollable {
        return this.child;
    }

    public override getChildren(): readonly TUIElement[] {
        return [this.child];
    }

    public performLayout(constraints: BoxConstraints): Size {
        // First, call parent implementation to set _size and mark as clean
        const containerSize = super.performLayout(constraints);

        // Set child local position (no offset for scroll container)
        this.child.localPosition = new Offset(0, 0);
        // Set child global position
        this.child.globalPosition = new Point(
            this.globalPosition.x + this.child.localPosition.dx,
            this.globalPosition.y + this.child.localPosition.dy,
        );

        // Perform child layout (with scrollbar width subtracted)
        this.child.performLayout(BoxConstraints.tight(new Size(containerSize.width - 1, containerSize.height)));

        return containerSize;
    }

    public render(context: RenderContext): void {
        // Render child with its local offset
        const childOffset = new Offset(this.child.localPosition.dx, this.child.localPosition.dy);
        this.child.render(context.withOffset(childOffset));

        renderScrollBar(
            context,
            this.size.width - 1,
            this.size.height,
            this.child.contentHeight,
            this.child.scrollTop,
            this.size.height,
        );
    }

    public override emit(event: TUIEvent): void {
        super.emit(event);
        this.child.emit(event);
    }
}
