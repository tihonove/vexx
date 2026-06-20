import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

export interface StatusBarItem {
    text: string;
    /** Side of the bar to render on. Defaults to "left". */
    align?: "left" | "right";
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
        return this.intrinsicWidth();
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.intrinsicWidth();
    }

    private leftText(): string {
        return this.items
            .filter((item) => item.align !== "right")
            .map((item) => item.text)
            .join("  ");
    }

    private rightText(): string {
        return this.items
            .filter((item) => item.align === "right")
            .map((item) => item.text)
            .join("  ");
    }

    private intrinsicWidth(): number {
        const left = this.leftText();
        const right = this.rightText();
        if (left.length > 0 && right.length > 0) {
            return left.length + 2 + right.length;
        }
        return left.length + right.length;
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

        const left = this.leftText();
        const right = this.rightText();

        // Background
        for (let x = 0; x < width; x++) {
            context.setCell(x, 0, { char: " ", fg: resolved.fg, bg: resolved.bg });
        }

        // Left-aligned items
        for (let x = 0; x < left.length && x < width; x++) {
            context.setCell(x, 0, { char: left[x], fg: resolved.fg, bg: resolved.bg });
        }

        // Right-aligned items, flush to the right edge. Skip any cell that falls
        // off the left edge (right text wider than the bar) or that a left item
        // already owns — left items win on overlap. The last cell always lands at
        // width-1, so an upper-bound check is unnecessary.
        const rightStart = width - right.length;
        for (let i = 0; i < right.length; i++) {
            const x = rightStart + i;
            if (x < 0 || x < left.length) continue;
            context.setCell(x, 0, { char: right[i], fg: resolved.fg, bg: resolved.bg });
        }
    }
}
