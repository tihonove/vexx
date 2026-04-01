import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

export interface StatusBarItem {
    text: string;
}

const STATUS_BAR_BG = packRgb(0, 122, 204);
const STATUS_BAR_FG = packRgb(255, 255, 255);

export class StatusBarElement extends TUIElement {
    private items: StatusBarItem[] = [];

    public setItems(items: StatusBarItem[]): void {
        this.items = items;
        this.markDirty();
    }

    public getItems(): readonly StatusBarItem[] {
        return this.items;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const size = new Size(constraints.maxWidth, 1);
        return super.performLayout(BoxConstraints.tight(size));
    }

    public override render(context: RenderContext): void {
        const { dx: ox, dy: oy } = context.offset;
        const width = this.size.width;

        const text = this.items.map((item) => item.text).join("  ");

        for (let x = 0; x < width; x++) {
            const char = x < text.length ? text[x] : " ";
            context.canvas.setCell(new Point(ox + x, oy), {
                char,
                fg: STATUS_BAR_FG,
                bg: STATUS_BAR_BG,
            });
        }
    }
}
