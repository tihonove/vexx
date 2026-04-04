import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR, packRgb } from "../../Rendering/ColorUtils.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { HFlexElement, hflexFill, hflexFit, hflexFixed } from "./HFlexElement.ts";
import { TextLabelElement } from "./TextLabelElement.ts";

const HIGHLIGHT_BG = packRgb(0, 90, 180);
const HIGHLIGHT_FG = packRgb(255, 255, 255);
const MENU_FG = DEFAULT_COLOR;
const MENU_BG = DEFAULT_COLOR;
const SHORTCUT_FG = packRgb(128, 128, 128);

export interface PopupMenuItemConfig {
    hasIconColumn: boolean;
    hasShortcuts: boolean;
}

export class PopupMenuItemElement extends TUIElement {
    public readonly label: string;
    public readonly shortcut: string | undefined;
    public readonly icon: string | undefined;
    public onSelect?: () => void;

    private hflex: HFlexElement;
    private iconLabel: TextLabelElement | null = null;
    private leftPadLabel: TextLabelElement | null = null;
    private labelElement: TextLabelElement;
    private shortcutLabel: TextLabelElement | null = null;
    private rightPadLabel: TextLabelElement | null = null;
    private selectedValue = false;

    public constructor(label: string, config: PopupMenuItemConfig, shortcut?: string, icon?: string) {
        super();
        this.label = label;
        this.shortcut = shortcut;
        this.icon = icon;
        this.hflex = new HFlexElement();

        if (config.hasIconColumn) {
            this.iconLabel = new TextLabelElement(icon ? icon + " " : "  ");
            this.hflex.addChild(this.iconLabel, { width: hflexFixed(2), height: "fill" });
        } else {
            this.leftPadLabel = new TextLabelElement(" ");
            this.hflex.addChild(this.leftPadLabel, { width: hflexFixed(1), height: "fill" });
        }

        const labelText = config.hasShortcuts ? label + " " : label;
        this.labelElement = new TextLabelElement(labelText);
        this.hflex.addChild(this.labelElement, { width: hflexFill(), height: "fill" });

        if (config.hasShortcuts && shortcut) {
            this.shortcutLabel = new TextLabelElement("  " + shortcut);
            this.hflex.addChild(this.shortcutLabel, { width: hflexFit(), height: "fill" });
        }

        if (!config.hasShortcuts) {
            this.rightPadLabel = new TextLabelElement(" ");
            this.hflex.addChild(this.rightPadLabel, { width: hflexFixed(1), height: "fill" });
        }

        this.hflex.setParent(this);
        this.applyStyles();
    }

    public get selected(): boolean {
        return this.selectedValue;
    }

    public set selected(value: boolean) {
        if (this.selectedValue === value) return;
        this.selectedValue = value;
        this.applyStyles();
        this.markDirty();
    }

    public override getChildren(): readonly TUIElement[] {
        return [this.hflex];
    }

    public override getMinIntrinsicWidth(height: number): number {
        return this.hflex.getMinIntrinsicWidth(height);
    }

    public override getMaxIntrinsicWidth(height: number): number {
        return this.hflex.getMaxIntrinsicWidth(height);
    }

    public override getMinIntrinsicHeight(width: number): number {
        return 1;
    }

    public override getMaxIntrinsicHeight(width: number): number {
        return 1;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const resultSize = super.performLayout(constraints);

        this.hflex.localPosition = new Offset(0, 0);
        this.hflex.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);
        this.hflex.performLayout(BoxConstraints.tight(resultSize));

        return resultSize;
    }

    public override render(context: RenderContext): void {
        const childOffset = new Offset(this.hflex.localPosition.dx, this.hflex.localPosition.dy);
        const childClip = new Rect(this.hflex.globalPosition, this.hflex.layoutSize);
        this.hflex.render(context.withOffset(childOffset).withClip(childClip));
    }

    private applyStyles(): void {
        const fg = this.selectedValue ? HIGHLIGHT_FG : MENU_FG;
        const bg = this.selectedValue ? HIGHLIGHT_BG : MENU_BG;

        if (this.iconLabel) this.iconLabel.setColors(fg, bg);
        if (this.leftPadLabel) this.leftPadLabel.setColors(fg, bg);
        this.labelElement.setColors(fg, bg);
        if (this.rightPadLabel) this.rightPadLabel.setColors(fg, bg);

        if (this.shortcutLabel) {
            const sFg = this.selectedValue ? HIGHLIGHT_FG : SHORTCUT_FG;
            this.shortcutLabel.setColors(sFg, bg);
        }
    }
}

export class PopupMenuSeparatorElement extends TUIElement {
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
            context.setCell(x, 0, { char: "─", fg: DEFAULT_COLOR, bg: DEFAULT_COLOR });
        }
    }
}
