import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { IScrollable } from "./IScrollable.ts";

export interface ScrollViewportInfo {
    readonly scrollTop: number;
    readonly scrollLeft: number;
    readonly viewportWidth: number;
    readonly viewportHeight: number;
}

export abstract class ScrollableElement extends TUIElement implements IScrollable {
    public scrollTop = 0;
    public scrollLeft = 0;

    public abstract get contentHeight(): number;
    public abstract get contentWidth(): number;

    public override getMinIntrinsicWidth(_height: number): number {
        return 0;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.contentWidth;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return 0;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return this.contentHeight;
    }

    public scrollBy(dx: number, dy: number): void {
        this.scrollTo(this.scrollLeft + dx, this.scrollTop + dy);
    }

    public scrollTo(left: number, top: number): void {
        const maxScrollTop = Math.max(0, this.contentHeight - this.layoutSize.height);
        const maxScrollLeft = Math.max(0, this.contentWidth - this.layoutSize.width);
        this.scrollTop = Math.max(0, Math.min(maxScrollTop, top));
        this.scrollLeft = Math.max(0, Math.min(maxScrollLeft, left));
    }

    public override render(context: RenderContext): void {
        const viewport: ScrollViewportInfo = {
            scrollTop: this.scrollTop,
            scrollLeft: this.scrollLeft,
            viewportWidth: this.layoutSize.width,
            viewportHeight: this.layoutSize.height,
        };
        this.renderViewport(context, viewport);
    }

    protected abstract renderViewport(context: RenderContext, viewport: ScrollViewportInfo): void;
}
