import { BoxConstraints, Offset, Point, Size } from "../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "./TUIElement.ts";

export interface ContextMenuLayerItem {
    element: TUIElement;
    position: Point;
    visible: boolean;
}

export class ContextMenuLayer extends TUIElement {
    private items: ContextMenuLayerItem[] = [];

    public addItem(element: TUIElement, position: Point, visible = false): void {
        element.setParent(this);
        this.items.push({ element, position, visible });
    }

    public removeItem(element: TUIElement): void {
        const index = this.items.findIndex((item) => item.element === element);
        if (index !== -1) {
            this.items[index].element.setParent(null);
            this.items.splice(index, 1);
        }
    }

    public setVisible(element: TUIElement, visible: boolean): void {
        const item = this.items.find((item) => item.element === element);
        if (item) {
            item.visible = visible;
        }
    }

    public setPosition(element: TUIElement, position: Point): void {
        const item = this.items.find((item) => item.element === element);
        if (item) {
            item.position = position;
        }
    }

    public hasVisibleItems(): boolean {
        return this.items.some((item) => item.visible);
    }

    public clearAll(): void {
        for (const item of this.items) {
            item.element.setParent(null);
        }
        this.items = [];
    }

    public getItems(): readonly ContextMenuLayerItem[] {
        return this.items;
    }

    public override getChildren(): readonly TUIElement[] {
        return this.items.map((item) => item.element);
    }

    public performLayout(constraints: BoxConstraints): Size {
        const layerSize = super.performLayout(constraints);

        for (const item of this.items) {
            if (!item.visible) continue;

            item.element.globalPosition = new Point(
                this.globalPosition.x + item.position.x,
                this.globalPosition.y + item.position.y,
            );
            item.element.localPosition = new Offset(item.position.x, item.position.y);

            // Constrain child so it doesn't overflow beyond the layer bounds
            const availableWidth = Math.max(0, layerSize.width - item.position.x);
            const availableHeight = Math.max(0, layerSize.height - item.position.y);
            item.element.performLayout(BoxConstraints.loose(new Size(availableWidth, availableHeight)));
        }

        return layerSize;
    }

    public render(context: RenderContext): void {
        for (const item of this.items) {
            if (!item.visible) continue;

            const childOffset = new Offset(item.position.x, item.position.y);
            item.element.render(context.withOffset(childOffset));
        }
    }

}
