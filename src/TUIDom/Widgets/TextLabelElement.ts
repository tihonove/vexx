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
    private charStyles = new Map<number, StyledChar>();

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
        this.style = { ...this.style, fg, bg };
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
        const resolved = this.resolvedStyle;

        for (let x = 0; x < width; x++) {
            const char = x < this.text.length ? this.text[x] : " ";
            const charStyle = this.charStyles.get(x);
            context.setCell(x, 0, {
                char,
                fg: charStyle?.fg ?? resolved.fg,
                bg: charStyle?.bg ?? resolved.bg,
                style: charStyle?.style ?? StyleFlags.None,
            });
        }
    }
}

// ─── TextLabel JSX Adapter ───

export interface TextLabelProps {
    text: string;
    fg?: number;
    bg?: number;
    charStyles?: Map<number, StyledChar>;
}

function applyTextLabelProps(el: TextLabelElement, props: TextLabelProps): void {
    el.setText(props.text);
    el.setColors(props.fg ?? DEFAULT_COLOR, props.bg ?? DEFAULT_COLOR);
    el.clearCharStyles();
    if (props.charStyles) {
        for (const [index, style] of props.charStyles) {
            el.setCharStyle(index, style);
        }
    }
}

export function TextLabel(props: TextLabelProps): TextLabelElement {
    const el = new TextLabelElement(props.text);
    applyTextLabelProps(el, props);
    return el;
}

TextLabel.update = (el: TUIElement, props: TextLabelProps): void => {
    applyTextLabelProps(el as TextLabelElement, props);
};
