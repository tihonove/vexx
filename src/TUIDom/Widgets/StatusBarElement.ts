import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

export interface StatusBarItem {
    text: string;
}

export class StatusBarElement extends TUIElement {
    private items: StatusBarItem[] = [];

    public setItems(items: StatusBarItem[]): void {
        this.items = items;
        this.markDirty();
    }

    public getItems(): readonly StatusBarItem[] {
        return this.items;
    }

    public override getMinIntrinsicWidth(_height: number): number {
        return this.items.map((item) => item.text).join("  ").length;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.items.map((item) => item.text).join("  ").length;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const size = new Size(constraints.maxWidth, 1);
        return super.performLayout(BoxConstraints.tight(size));
    }

    public override render(context: RenderContext): void {
        const width = this.layoutSize.width;
        const resolved = this.resolvedStyle;

        const text = this.items.map((item) => item.text).join("  ");

        for (let x = 0; x < width; x++) {
            const char = x < text.length ? text[x] : " ";
            context.setCell(x, 0, {
                char,
                fg: resolved.fg,
                bg: resolved.bg,
            });
        }
    }
}
