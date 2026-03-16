import { Offset, Point, Rect, Size } from "../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "./TUIElement.ts";

export interface VStackLayoutStyle {
    width: number | "fill";
    height: number;
}

export interface VStackLayoutState {
    rect: Rect;
}

interface VStackChild {
    element: TUIElement;
    style: VStackLayoutStyle;
    state?: VStackLayoutState;
}

export class VStackElement extends TUIElement {
    private children: VStackChild[] = [];

    public addChild(child: TUIElement, style: VStackLayoutStyle): void {
        this.children.push({ element: child, style });
    }

    public getChildren(): readonly TUIElement[] {
        return this.children.map((c) => c.element);
    }

    public performLayout(): void {
        let currentY = 0;
        const containerWidth = this.size.width;

        for (const child of this.children) {
            const childWidth = child.style.width === "fill" ? containerWidth : child.style.width;
            const childHeight = child.style.height;
            const childSize = new Size(childWidth, childHeight);

            child.state = {
                rect: new Rect(new Point(0, currentY), childSize),
            };
            child.element.size = childSize;

            currentY += childHeight;
        }
    }

    public render(context: RenderContext): void {
        this.performLayout();
        for (const child of this.children) {
            if (!child.state) continue;
            const { origin } = child.state.rect;
            child.element.render(context.withOffset(new Offset(origin.x, origin.y)));
        }
    }
}
