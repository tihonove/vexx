import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR } from "../../Rendering/ColorUtils.ts";
import type { JsxChild } from "../JSX/jsx-runtime.ts";
import { normalizeChildren, reconcileChildren } from "../JSX/reconcile.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { BORDER } from "./BorderGlyphs.ts";

export interface BoxContainerProps {
    bg?: number;
    fg?: number;
    borderFg?: number;
    title?: string;
    titleFg?: number;
    hasSeparator?: boolean;
    children?: JsxChild;
}

export class BoxContainerElement extends TUIElement {
    private bg: number;
    private fg: number;
    private borderFg: number;
    private title: string | undefined;
    private titleFg: number;
    private hasSeparator: boolean;
    private child: TUIElement | null = null;

    public constructor() {
        super();
        this.bg = DEFAULT_COLOR;
        this.fg = DEFAULT_COLOR;
        this.borderFg = DEFAULT_COLOR;
        this.titleFg = DEFAULT_COLOR;
        this.hasSeparator = false;
    }

    public setBg(value: number): void {
        this.bg = value;
        this.markDirty();
    }

    public setFg(value: number): void {
        this.fg = value;
        this.markDirty();
    }

    public setBorderFg(value: number): void {
        this.borderFg = value;
        this.markDirty();
    }

    public setTitle(value: string | undefined): void {
        this.title = value;
        this.markDirty();
    }

    public setTitleFg(value: number): void {
        this.titleFg = value;
        this.markDirty();
    }

    public setHasSeparator(value: boolean): void {
        this.hasSeparator = value;
        this.markDirty();
    }

    public setChild(child: TUIElement | null): void {
        if (this.child) {
            this.child.setParent(null);
        }
        this.child = child;
        if (this.child) {
            this.child.setParent(this);
        }
        this.markDirty();
    }

    public override getChildren(): readonly TUIElement[] {
        return this.child ? [this.child] : [];
    }

    private get headerRows(): number {
        if (!this.title) return 0;
        return this.hasSeparator ? 2 : 1;
    }

    public override getMinIntrinsicWidth(height: number): number {
        if (!this.child) return 2;
        return this.child.getMinIntrinsicWidth(height) + 2;
    }

    public override getMaxIntrinsicWidth(height: number): number {
        if (!this.child) return 2;
        return this.child.getMaxIntrinsicWidth(height) + 2;
    }

    public override getMinIntrinsicHeight(width: number): number {
        const paddingY = 2 + this.headerRows;
        if (!this.child) return paddingY;
        return this.child.getMinIntrinsicHeight(Math.max(0, width - 2)) + paddingY;
    }

    public override getMaxIntrinsicHeight(width: number): number {
        const paddingY = 2 + this.headerRows;
        if (!this.child) return paddingY;
        return this.child.getMaxIntrinsicHeight(Math.max(0, width - 2)) + paddingY;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);
        if (this.child) {
            const paddingX = 1;
            const paddingTop = 1 + this.headerRows;
            const paddingBottom = 1;
            const childWidth = Math.max(0, containerSize.width - paddingX * 2);
            const childHeight = Math.max(0, containerSize.height - paddingTop - paddingBottom);
            const childX = paddingX;
            const childY = paddingTop;
            this.child.localPosition = new Offset(childX, childY);
            this.child.globalPosition = new Point(this.globalPosition.x + childX, this.globalPosition.y + childY);
            this.child.performLayout(BoxConstraints.tight(new Size(childWidth, childHeight)));
        }
        return containerSize;
    }

    public override render(context: RenderContext): void {
        const w = this.layoutSize.width;
        const h = this.layoutSize.height;

        // Fill background
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                context.setCell(x, y, { char: " ", fg: this.fg, bg: this.bg });
            }
        }

        // Top border
        context.setCell(0, 0, { char: BORDER.topLeft, fg: this.borderFg, bg: this.bg });
        for (let x = 1; x < w - 1; x++) context.setCell(x, 0, { char: "─", fg: this.borderFg, bg: this.bg });
        context.setCell(w - 1, 0, { char: BORDER.topRight, fg: this.borderFg, bg: this.bg });

        // Side borders
        for (let y = 1; y < h - 1; y++) {
            context.setCell(0, y, { char: "│", fg: this.borderFg, bg: this.bg });
            context.setCell(w - 1, y, { char: "│", fg: this.borderFg, bg: this.bg });
        }

        // Bottom border
        context.setCell(0, h - 1, { char: BORDER.bottomLeft, fg: this.borderFg, bg: this.bg });
        for (let x = 1; x < w - 1; x++) context.setCell(x, h - 1, { char: "─", fg: this.borderFg, bg: this.bg });
        context.setCell(w - 1, h - 1, { char: BORDER.bottomRight, fg: this.borderFg, bg: this.bg });

        // Title row (y=1)
        if (this.title) {
            const titleX = Math.floor((w - this.title.length) / 2);
            context.drawText(titleX, 1, this.title, { fg: this.titleFg, bg: this.bg });

            // Separator (y=2)
            if (this.hasSeparator) {
                context.setCell(0, 2, { char: "├", fg: this.borderFg, bg: this.bg });
                for (let x = 1; x < w - 1; x++) context.setCell(x, 2, { char: "─", fg: this.borderFg, bg: this.bg });
                context.setCell(w - 1, 2, { char: "┤", fg: this.borderFg, bg: this.bg });
            }
        }

        // Render child
        if (this.child) {
            const childOffset = new Offset(this.child.localPosition.dx, this.child.localPosition.dy);
            const childClip = new Rect(this.child.globalPosition, this.child.layoutSize);
            this.child.render(context.withOffset(childOffset).withClip(childClip));
        }
    }
}

// ─── BoxContainer JSX Adapter ───

function applyBoxContainerProps(el: BoxContainerElement, props: BoxContainerProps): void {
    if (props.bg !== undefined) el.setBg(props.bg);
    if (props.fg !== undefined) el.setFg(props.fg);
    if (props.borderFg !== undefined) el.setBorderFg(props.borderFg);
    el.setTitle(props.title);
    if (props.titleFg !== undefined) el.setTitleFg(props.titleFg);
    el.setHasSeparator(props.hasSeparator ?? false);
}

export function BoxContainer(props: BoxContainerProps): BoxContainerElement {
    const el = new BoxContainerElement();
    applyBoxContainerProps(el, props);
    if (props.children !== undefined) {
        const nodes = normalizeChildren(props.children);
        const children = reconcileChildren([], nodes);
        el.setChild(children[0] ?? null);
    }
    return el;
}

BoxContainer.update = (el: TUIElement, props: BoxContainerProps): void => {
    const box = el as BoxContainerElement;
    applyBoxContainerProps(box, props);
    const nodes = normalizeChildren(props.children);
    const newChildren = reconcileChildren(box.getChildren(), nodes);
    box.setChild(newChildren[0] ?? null);
};
