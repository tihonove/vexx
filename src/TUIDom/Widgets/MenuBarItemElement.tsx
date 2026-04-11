import { DEFAULT_COLOR, packRgb } from "../../Rendering/ColorUtils.ts";
import { StyleFlags } from "../../Rendering/StyleFlags.ts";
import { CompositeElement } from "../CompositeElement.ts";
import type { JsxNode } from "../JSX/jsx-runtime.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { StyledChar } from "./TextLabelElement.ts";
import { TextLabel } from "./TextLabelElement.ts";

export const MENU_BAR_FG = DEFAULT_COLOR;
export const MENU_BAR_BG = packRgb(64, 64, 64);
export const ACTIVE_MENU_FG = packRgb(255, 255, 255);
export const ACTIVE_MENU_BG = packRgb(0, 90, 180);

export class MenuBarItemElement extends CompositeElement {
    public readonly label: string;
    public readonly mnemonic: string | undefined;
    public onActivate: (() => void) | null = null;
    private activeValue = false;

    public constructor(label: string, mnemonic?: string) {
        super();
        this.label = label;
        this.mnemonic = mnemonic;

        this.addEventListener("click", (event) => {
            if (event.defaultPrevented) return;
            this.onActivate?.();
        });

        this.rebuild();
    }

    public get active(): boolean {
        return this.activeValue;
    }

    public set active(value: boolean) {
        if (this.activeValue === value) return;
        this.activeValue = value;
        this.rebuild();
    }

    public describe(): JsxNode {
        const fg = this.activeValue ? ACTIVE_MENU_FG : MENU_BAR_FG;
        const bg = this.activeValue ? ACTIVE_MENU_BG : MENU_BAR_BG;
        return <TextLabel text={` ${this.label} `} fg={fg} bg={bg} charStyles={this.buildCharStyles()} />;
    }

    private buildCharStyles(): Map<number, StyledChar> | undefined {
        const mnemonicIndex = this.getMnemonicIndex();
        if (mnemonicIndex < 0) return undefined;
        const styles = new Map<number, StyledChar>();
        styles.set(mnemonicIndex + 1, { style: StyleFlags.Underline });
        return styles;
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
