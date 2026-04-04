import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR } from "../../Rendering/ColorUtils.ts";
import { StyleFlags } from "../../Rendering/StyleFlags.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

export interface StyledChar {
    fg?: number;
    bg?: number;
    style?: StyleFlags;
}

export class TextLabelElement extends TUIElement {
    private text: string;
    private fg: number = DEFAULT_COLOR;
    private bg: number = DEFAULT_COLOR;
    private charStyles: Map<number, StyledChar> = new Map();

    public constructor(text: string) {
        super();
        this.text = text;
    }

    public getText(): string {
        return this.text;
    }

    public setText(text: string): void {
        this.text = text;
        this.markDirty();
    }

    public setColors(fg: number, bg: number): void {
        this.fg = fg;
        this.bg = bg;
        this.markDirty();
    }

    public setCharStyle(index: number, charStyle: StyledChar): void {
        this.charStyles.set(index, charStyle);
        this.markDirty();
    }

    public clearCharStyles(): void {
        this.charStyles.clear();
        this.markDirty();
    }

    public override getMinIntrinsicWidth(_height: number): number {
        return this.text.length;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.text.length;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const width = constraints.constrain(new Size(this.text.length, 1)).width;
        return super.performLayout(BoxConstraints.tight(new Size(width, 1)));
    }

    public override render(context: RenderContext): void {
        const width = this.layoutSize.width;

        for (let x = 0; x < width; x++) {
            const char = x < this.text.length ? this.text[x] : " ";
            const charStyle = this.charStyles.get(x);
            context.setCell(x, 0, {
                char,
                fg: charStyle?.fg ?? this.fg,
                bg: charStyle?.bg ?? this.bg,
                style: charStyle?.style ?? StyleFlags.None,
            });
        }
    }
}
