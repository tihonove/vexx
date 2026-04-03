import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

export interface VStackLayoutStyle {
    width: number | "fill";
    height: number;
}

export interface VStackLayoutState {
    rect: Rect;
}

export class VStackElement extends TUIElement {
    private children: TUIElement[] = [];

    public addChild(child: TUIElement, style: VStackLayoutStyle): void {
        child.layoutStyle = style;
        child.setParent(this); // Set parent for dirty propagation
        this.children.push(child);
    }

    public getChildren(): readonly TUIElement[] {
        return this.children;
    }

    public performLayout(constraints: BoxConstraints): Size {
        // First, call parent implementation to set allocatedSize and mark as clean
        const containerSize = super.performLayout(constraints);
        const containerWidth = containerSize.width;
        let currentY = 0;

        for (const child of this.children) {
            const style = child.layoutStyle as VStackLayoutStyle;
            const childWidth = style.width === "fill" ? containerWidth : style.width;
            const childHeight = style.height;
            const childSize = new Size(childWidth, childHeight);

            // Set local position (relative to this container)
            child.localPosition = new Offset(0, currentY);
            // Set global position (absolute screen coords)
            child.globalPosition = new Point(
                this.globalPosition.x + child.localPosition.dx,
                this.globalPosition.y + child.localPosition.dy,
            );

            // Store in layoutState for compatibility
            child.layoutState = {
                rect: new Rect(new Point(0, currentY), childSize),
            };

            // Perform child layout
            child.performLayout(BoxConstraints.tight(childSize));

            currentY += childHeight;
        }

        return containerSize;
    }

    public render(context: RenderContext): void {
        for (const child of this.children) {
            // Use localPosition from coordinate system instead of layoutState
            const childOffset = new Offset(child.localPosition.dx, child.localPosition.dy);
            const childClip = new Rect(child.globalPosition, child.layoutSize);
            child.render(context.withOffset(childOffset).withClip(childClip));
        }
    }
}
