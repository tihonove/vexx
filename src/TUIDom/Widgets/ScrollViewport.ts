import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { IScrollable } from "./IScrollable.ts";

/**
 * Scroll engine: wraps a scrollable child, applies scroll offset and clips
 * rendering to the viewport bounds. The child draws full content in local
 * coordinates; ScrollViewport shifts by -scrollTop and clips so only the
 * visible region produces cells on screen.
 *
 * Implements IScrollable by delegating to the wrapped child, so it can be
 * nested inside ScrollBarDecorator or any other consumer of IScrollable.
 */
export class ScrollViewport extends TUIElement implements IScrollable {
    private child: TUIElement & IScrollable;

    public constructor(child: TUIElement & IScrollable) {
        super();
        this.child = child;
        this.child.setParent(this);
    }

    public get contentHeight(): number {
        return this.child.contentHeight;
    }

    public get scrollTop(): number {
        return this.child.scrollTop;
    }

    public getChild(): TUIElement & IScrollable {
        return this.child;
    }

    public override getChildren(): readonly TUIElement[] {
        return [this.child];
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const size = super.performLayout(constraints);

        this.child.localPosition = new Offset(0, 0);
        this.child.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);

        // Give child the full viewport size — it draws all content in local coords
        this.child.performLayout(BoxConstraints.tight(size));

        return size;
    }

    public override render(context: RenderContext): void {
        const scrollOffset = new Offset(0, -this.child.scrollTop);
        const viewportClip = new Rect(this.globalPosition, this.layoutSize);
        this.child.render(context.withOffset(scrollOffset).withClip(viewportClip));
    }
}
