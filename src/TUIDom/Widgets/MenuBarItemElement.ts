import { BoxConstraints, Offset, Point, Size } from "../../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR, packRgb } from "../../Rendering/ColorUtils.ts";
import { StyleFlags } from "../../Rendering/StyleFlags.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { TextLabelElement } from "./TextLabelElement.ts";

const MENU_BAR_FG = DEFAULT_COLOR;
const MENU_BAR_BG = packRgb(64, 64, 64);
const ACTIVE_MENU_FG = packRgb(255, 255, 255);
const ACTIVE_MENU_BG = packRgb(0, 90, 180);

export class MenuBarItemElement extends TUIElement {
    public readonly label: string;
    public readonly mnemonic: string | undefined;
    public onActivate: (() => void) | null = null;
    private textLabel: TextLabelElement;
    private activeValue = false;

    public constructor(label: string, mnemonic?: string) {
        super();
        this.label = label;
        this.mnemonic = mnemonic;

        this.textLabel = new TextLabelElement(` ${label} `);
        this.textLabel.setParent(this);
        this.applyStyles();

        this.addEventListener("click", (event) => {
            if (event.defaultPrevented) return;
            this.onActivate?.();
        });
    }

    public get active(): boolean {
        return this.activeValue;
    }

    public set active(value: boolean) {
        if (this.activeValue === value) return;
        this.activeValue = value;
        this.applyStyles();
        this.markDirty();
    }

    public override getChildren(): readonly TUIElement[] {
        return [this.textLabel];
    }

    public override getMinIntrinsicWidth(_height: number): number {
        return this.textLabel.getMinIntrinsicWidth(_height);
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.textLabel.getMaxIntrinsicWidth(_height);
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return this.textLabel.getMinIntrinsicHeight(_width);
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return this.textLabel.getMaxIntrinsicHeight(_width);
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const intrinsicWidth = this.textLabel.getMaxIntrinsicWidth(1);
        const size = new Size(intrinsicWidth, 1);
        const resultSize = super.performLayout(BoxConstraints.tight(size));

        this.textLabel.localPosition = new Offset(0, 0);
        this.textLabel.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);
        this.textLabel.performLayout(BoxConstraints.tight(resultSize));

        return resultSize;
    }

    public override render(context: RenderContext): void {
        this.textLabel.render(context.withOffset(this.textLabel.localPosition));
    }

    private applyStyles(): void {
        const fg = this.activeValue ? ACTIVE_MENU_FG : MENU_BAR_FG;
        const bg = this.activeValue ? ACTIVE_MENU_BG : MENU_BAR_BG;
        this.textLabel.setColors(fg, bg);

        this.textLabel.clearCharStyles();
        const mnemonicIndex = this.getMnemonicIndex();
        if (mnemonicIndex >= 0) {
            this.textLabel.setCharStyle(mnemonicIndex + 1, { style: StyleFlags.Underline });
        }
    }

    private getMnemonicIndex(): number {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const mnemonic = (this.mnemonic ?? this.label[0] ?? "").toLowerCase();
        return this.label.toLowerCase().indexOf(mnemonic);
    }
}

export class MenuBarFillerElement extends TUIElement {
    public override getMinIntrinsicWidth(_height: number): number {
        return 0;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return 0;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override render(context: RenderContext): void {
        const width = this.layoutSize.width;
        for (let x = 0; x < width; x++) {
            context.setCell(x, 0, { char: " ", fg: MENU_BAR_FG, bg: MENU_BAR_BG });
        }
    }
}
