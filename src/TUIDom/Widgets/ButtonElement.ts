import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../vs/tui/rendering/colorUtils.ts";
import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

// Defaults preserve the historical look; owners (e.g. a dialog) override them from the theme.
const BUTTON_FG = packRgb(204, 204, 204);
const BUTTON_BG = packRgb(60, 60, 60);
const BUTTON_HOVER_BG = packRgb(69, 73, 78);
const BUTTON_SEL_FG = packRgb(255, 255, 255);
const BUTTON_SEL_BG = packRgb(0, 120, 215);
const BUTTON_SEL_HOVER_BG = packRgb(26, 134, 224);

export class ButtonElement extends TUIElement {
    public onActivate?: () => void;

    // ─── Theme colors (overridable from outside) ───
    public normalFg = BUTTON_FG;
    public normalBg = BUTTON_BG;
    public normalHoverBg = BUTTON_HOVER_BG;
    public focusedFg = BUTTON_SEL_FG;
    public focusedBg = BUTTON_SEL_BG;
    public focusedHoverBg = BUTTON_SEL_HOVER_BG;

    private readonly label: string;
    private hovered = false;

    public constructor(label: string) {
        super();
        this.label = label;
        this.tabIndex = 0;

        this.addEventListener("focus", () => {
            this.markDirty();
        });
        this.addEventListener("blur", () => {
            this.markDirty();
        });
        this.addEventListener("click", (event) => {
            if (event.defaultPrevented) return;
            this.onActivate?.();
        });
        this.addEventListener("mouseenter", () => {
            if (this.hovered) return;
            this.hovered = true;
            this.markDirty();
        });
        this.addEventListener("mouseleave", () => {
            if (!this.hovered) return;
            this.hovered = false;
            this.markDirty();
        });
    }

    public getLabel(): string {
        return this.label;
    }

    public override getMinIntrinsicWidth(_height: number): number {
        return this.label.length + 4;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.label.length + 4;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        return super.performLayout(BoxConstraints.tight(new Size(this.label.length + 4, 1)));
    }

    protected override performDefaultAction(event: TUIEventBase): void {
        if (event.type !== "keydown") return;
        const keyEvent = event as TUIKeyboardEvent;
        if (keyEvent.key === "Enter" || keyEvent.key === " ") {
            event.preventDefault();
            this.onActivate?.();
        }
    }

    public override render(context: RenderContext): void {
        const focused = this.isFocused;
        const fg = focused ? this.focusedFg : this.normalFg;
        const bg = focused
            ? this.hovered
                ? this.focusedHoverBg
                : this.focusedBg
            : this.hovered
              ? this.normalHoverBg
              : this.normalBg;
        context.drawText(0, 0, `[ ${this.label} ]`, { fg, bg });
    }
}
