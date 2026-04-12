import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { StyleFlags } from "../../Rendering/StyleFlags.ts";
import type { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

const CLOSE_CHAR = "×";
const MODIFIED_CHAR = "●";

export class EditorTabItemElement extends TUIElement {
    private label: string;
    private icon: string;
    private iconColor: number;
    private modified: boolean;
    private paddingLeft: number;
    private paddingRight: number;

    public onActivate: (() => void) | null = null;
    public onClose: (() => void) | null = null;

    public constructor(
        label: string,
        icon: string,
        iconColor: number,
        options?: { modified?: boolean; paddingLeft?: number; paddingRight?: number },
    ) {
        super();
        this.label = label;
        this.icon = icon;
        this.iconColor = iconColor;
        this.modified = options?.modified ?? false;
        this.paddingLeft = options?.paddingLeft ?? 1;
        this.paddingRight = options?.paddingRight ?? 1;

        this.addEventListener("click", (event) => {
            const mouseEvent = event;
            const closeStart = this.getCloseButtonStart();
            if (mouseEvent.localX >= closeStart && mouseEvent.localX < closeStart + CLOSE_CHAR.length) {
                this.onClose?.();
            } else {
                this.onActivate?.();
            }
        });
    }

    public getLabel(): string {
        return this.label;
    }

    public setLabel(label: string): void {
        this.label = label;
        this.markDirty();
    }

    public getIcon(): string {
        return this.icon;
    }

    public setIcon(icon: string, color: number): void {
        this.icon = icon;
        this.iconColor = color;
        this.markDirty();
    }

    public getModified(): boolean {
        return this.modified;
    }

    public setModified(modified: boolean): void {
        if (this.modified === modified) return;
        this.modified = modified;
        this.markDirty();
    }

    public getPaddingLeft(): number {
        return this.paddingLeft;
    }

    public setPaddingLeft(value: number): void {
        this.paddingLeft = value;
        this.markDirty();
    }

    public getPaddingRight(): number {
        return this.paddingRight;
    }

    public setPaddingRight(value: number): void {
        this.paddingRight = value;
        this.markDirty();
    }

    // ─── Content Layout ───

    private getContentWidth(): number {
        // [paddingLeft][icon " "][label][" ●" or " "][" ×"][paddingRight]
        const iconPart = this.icon.length > 0 ? this.icon.length + 1 : 0; // icon + space
        const modifiedPart = this.modified ? 2 : 0; // " ●"
        const closePart = 2; // " ×"
        return this.paddingLeft + iconPart + this.label.length + modifiedPart + closePart + this.paddingRight;
    }

    private getCloseButtonStart(): number {
        return this.getContentWidth() - this.paddingRight - CLOSE_CHAR.length;
    }

    // ─── Intrinsic Size ───

    public override getMinIntrinsicWidth(_height: number): number {
        return this.getContentWidth();
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.getContentWidth();
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const width = constraints.constrain(new Size(this.getContentWidth(), 1)).width;
        return super.performLayout(BoxConstraints.tight(new Size(width, 1)));
    }

    // ─── Render ───

    public override render(context: RenderContext): void {
        const width = this.layoutSize.width;
        const resolved = this.resolvedStyle;
        let x = 0;

        // Fill background for the whole width first
        for (let i = 0; i < width; i++) {
            context.setCell(i, 0, { char: " ", fg: resolved.fg, bg: resolved.bg });
        }

        // Padding left (already filled with spaces)
        x += this.paddingLeft;

        // Icon
        if (this.icon.length > 0 && x < width) {
            context.setCell(x, 0, { char: this.icon, fg: this.iconColor, bg: resolved.bg });
            x += this.icon.length;
            if (x < width) {
                context.setCell(x, 0, { char: " ", fg: resolved.fg, bg: resolved.bg });
                x += 1;
            }
        }

        // Label
        for (let i = 0; i < this.label.length && x < width; i++) {
            context.setCell(x, 0, { char: this.label[i], fg: resolved.fg, bg: resolved.bg });
            x += 1;
        }

        // Modified indicator
        if (this.modified && x + 1 < width) {
            context.setCell(x, 0, { char: " ", fg: resolved.fg, bg: resolved.bg });
            x += 1;
            context.setCell(x, 0, { char: MODIFIED_CHAR, fg: resolved.fg, bg: resolved.bg });
            x += 1;
        }

        // Close button: " ×"
        if (x + 1 < width) {
            context.setCell(x, 0, { char: " ", fg: resolved.fg, bg: resolved.bg });
            x += 1;
            context.setCell(x, 0, {
                char: CLOSE_CHAR,
                fg: resolved.fg,
                bg: resolved.bg,
                style: StyleFlags.None,
            });
        }
    }
}
