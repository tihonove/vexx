import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR, packRgb } from "../../Rendering/ColorUtils.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { IScrollable } from "./IScrollable.ts";
import type { ScrollBarColors } from "./ScrollBarRenderer.ts";
import { renderHorizontalScrollBar, renderScrollBar } from "./ScrollBarRenderer.ts";

export type ScrollBarPolicy = "auto" | "always" | "never";

// Standalone defaults for theme-less use (stories, tests). Controllers overwrite
// these from the active theme in their applyTheme — see FileTreeController.
const DEFAULT_THUMB_COLOR = packRgb(100, 100, 100);
const DEFAULT_TRACK_COLOR = packRgb(50, 50, 50);

/**
 * Draws scrollbars alongside a scrollable child.
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
    public verticalScrollBar: ScrollBarPolicy = "auto";
    public horizontalScrollBar: ScrollBarPolicy = "auto";
    public thumbColor = DEFAULT_THUMB_COLOR;
    public trackColor = DEFAULT_TRACK_COLOR;
    /** Fills the scrollbar row/column so the widget's own background shows, not the terminal's. */
    public backgroundColor: number = DEFAULT_COLOR;

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

        const { showVertical, showHorizontal } = this.resolveScrollBarVisibility(containerSize);
        const childWidth = containerSize.width - (showVertical ? 1 : 0);
        const childHeight = containerSize.height - (showHorizontal ? 1 : 0);

        this.child.performLayout(BoxConstraints.tight(new Size(childWidth, childHeight)));

        return containerSize;
    }

    public render(context: RenderContext): void {
        const { showVertical, showHorizontal } = this.resolveScrollBarVisibility(this.layoutSize);

        const childOffset = new Offset(this.child.localPosition.dx, this.child.localPosition.dy);
        const childClip = new Rect(this.child.globalPosition, this.child.layoutSize);
        this.child.render(context.withOffset(childOffset).withClip(childClip));

        const childWidth = this.child.layoutSize.width;
        const childHeight = this.child.layoutSize.height;
        const colors: ScrollBarColors = {
            thumb: this.thumbColor,
            track: this.trackColor,
            background: this.backgroundColor,
        };

        if (showVertical) {
            renderScrollBar(
                context,
                this.layoutSize.width - 1,
                childHeight,
                this.child.contentHeight,
                this.child.scrollTop,
                childHeight,
                colors,
            );
        }

        if (showHorizontal) {
            renderHorizontalScrollBar(
                context,
                this.layoutSize.height - 1,
                childWidth,
                this.child.contentWidth,
                this.child.scrollLeft,
                childWidth,
                colors,
            );
        }
    }

    private resolveScrollBarVisibility(containerSize: Size): { showVertical: boolean; showHorizontal: boolean } {
        const showVertical = this.resolvePolicy(this.verticalScrollBar, this.child.contentHeight, containerSize.height);
        const showHorizontal = this.resolvePolicy(
            this.horizontalScrollBar,
            this.child.contentWidth,
            containerSize.width - (showVertical ? 1 : 0),
        );
        return { showVertical, showHorizontal };
    }

    private resolvePolicy(policy: ScrollBarPolicy, contentSize: number, viewportSize: number): boolean {
        switch (policy) {
            case "always":
                return true;
            case "never":
                return false;
            case "auto":
                return contentSize > viewportSize;
        }
    }
}

/** @deprecated Use ScrollBarDecorator instead */
export const ScrollContainerElement = ScrollBarDecorator;
