import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { IScrollable } from "./IScrollable.ts";
import { renderScrollBar } from "./ScrollBarRenderer.ts";

/**
 * Draws a scrollbar alongside a scrollable child.
 *
 * The child is rendered as-is — it must handle its own content rendering.
 * For simple widgets that draw full content in local coordinates, wrap
 * them in a ScrollViewport before passing to ScrollBarDecorator:
 *
 *   new ScrollBarDecorator(new ScrollViewport(textBlock))
 *
 * For self-scrolling widgets (e.g. EditorElement) that already manage
 * their own scroll offset, pass them directly:
 *
 *   new ScrollBarDecorator(editorElement)
 */
export class ScrollBarDecorator extends TUIElement {
    private child: TUIElement & IScrollable;

    public constructor(child: TUIElement & IScrollable) {
        super();
        this.child = child;
        this.child.setParent(this);
    }

    public getChild(): TUIElement & IScrollable {
        return this.child;
    }

    public setChild(child: TUIElement & IScrollable): void {
        this.child = child;
        this.child.setParent(this);
        this.markDirty();
    }

    public override getChildren(): readonly TUIElement[] {
        return [this.child];
    }

    public performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);

        this.child.localPosition = new Offset(0, 0);
        this.child.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);

        // Child gets container width minus scrollbar column
        this.child.performLayout(BoxConstraints.tight(new Size(containerSize.width - 1, containerSize.height)));

        return containerSize;
    }

    public render(context: RenderContext): void {
        const childOffset = new Offset(this.child.localPosition.dx, this.child.localPosition.dy);
        const childClip = new Rect(this.child.globalPosition, this.child.layoutSize);
        this.child.render(context.withOffset(childOffset).withClip(childClip));

        renderScrollBar(
            context,
            this.layoutSize.width - 1,
            this.layoutSize.height,
            this.child.contentHeight,
            this.child.scrollTop,
            this.layoutSize.height,
        );
    }
}

/** @deprecated Use ScrollBarDecorator instead */
export const ScrollContainerElement = ScrollBarDecorator;
