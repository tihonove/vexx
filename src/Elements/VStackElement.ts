import { BoxConstraints, Offset, Point, Rect, Size } from "../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "./TUIElement.ts";

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
        this.children.push(child);
    }

    public getChildren(): readonly TUIElement[] {
        return this.children;
    }

    public performLayout(constraints: BoxConstraints): void {
        this.size = new Size(constraints.maxWidth, constraints.maxHeight);
        let currentY = 0;
        const containerWidth = this.size.width;

        for (const child of this.children) {
            const style = child.layoutStyle as VStackLayoutStyle;
            const childWidth = style.width === "fill" ? containerWidth : style.width;
            const childHeight = style.height;
            const childSize = new Size(childWidth, childHeight);

            child.layoutState = {
                rect: new Rect(new Point(0, currentY), childSize),
            };
            child.performLayout(BoxConstraints.tight(childSize));

            currentY += childHeight;
        }
    }

    public render(context: RenderContext): void {
        for (const child of this.children) {
            const state = child.layoutState as VStackLayoutState | undefined;
            if (!state) continue;
            const { origin } = state.rect;
            child.render(context.withOffset(new Offset(origin.x, origin.y)));
        }
    }
}
