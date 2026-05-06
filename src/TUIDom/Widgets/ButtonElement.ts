import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

const BUTTON_FG = packRgb(204, 204, 204);
const BUTTON_BG = packRgb(60, 60, 60);
const BUTTON_SEL_FG = packRgb(255, 255, 255);
const BUTTON_SEL_BG = packRgb(0, 120, 215);

export class ButtonElement extends TUIElement {
    public onActivate?: () => void;

    private readonly label: string;

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
        const fg = focused ? BUTTON_SEL_FG : BUTTON_FG;
        const bg = focused ? BUTTON_SEL_BG : BUTTON_BG;
        context.drawText(0, 0, `[ ${this.label} ]`, { fg, bg });
    }
}
