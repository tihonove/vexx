import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

export interface Padding {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
}

export class PaddingContainerElement extends TUIElement {
    private child: TUIElement;
    private top: number;
    private right: number;
    private bottom: number;
    private left: number;

    public constructor(child: TUIElement, padding?: Padding) {
        super();
        this.child = child;
        this.child.setParent(this);
        this.top = padding?.top ?? 0;
        this.right = padding?.right ?? 0;
        this.bottom = padding?.bottom ?? 0;
        this.left = padding?.left ?? 0;
    }

    public override getChildren(): readonly TUIElement[] {
        return [this.child];
    }

    public getPaddingTop(): number {
        return this.top;
    }

    public setPaddingTop(value: number): void {
        this.top = value;
        this.markDirty();
    }

    public getPaddingRight(): number {
        return this.right;
    }

    public setPaddingRight(value: number): void {
        this.right = value;
        this.markDirty();
    }

    public getPaddingBottom(): number {
        return this.bottom;
    }

    public setPaddingBottom(value: number): void {
        this.bottom = value;
        this.markDirty();
    }

    public getPaddingLeft(): number {
        return this.left;
    }

    public setPaddingLeft(value: number): void {
        this.left = value;
        this.markDirty();
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);

        const childWidth = Math.max(0, containerSize.width - this.left - this.right);
        const childHeight = Math.max(0, containerSize.height - this.top - this.bottom);

        this.child.localPosition = new Offset(this.left, this.top);
        this.child.globalPosition = new Point(this.globalPosition.x + this.left, this.globalPosition.y + this.top);
        this.child.performLayout(BoxConstraints.tight(new Size(childWidth, childHeight)));

        return containerSize;
    }

    public override render(context: RenderContext): void {
        const childOffset = new Offset(this.child.localPosition.dx, this.child.localPosition.dy);
        const childClip = new Rect(this.child.globalPosition, this.child.layoutSize);
        this.child.render(context.withOffset(childOffset).withClip(childClip));
    }
}
