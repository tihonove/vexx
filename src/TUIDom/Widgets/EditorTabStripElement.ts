import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR, packRgb } from "../../Rendering/ColorUtils.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { EditorTabItemElement } from "./EditorTabItemElement.ts";
import { HFlexElement, hflexFill, hflexFit } from "./HFlexElement.ts";

// ─── Default Colors ───

const ACTIVE_TAB_FG = packRgb(255, 255, 255);
const ACTIVE_TAB_BG = packRgb(30, 30, 30);
const INACTIVE_TAB_FG = packRgb(150, 150, 150);
const INACTIVE_TAB_BG = packRgb(45, 45, 45);
const STRIP_BG = packRgb(37, 37, 38);

// ─── Tab Info ───

export interface TabInfo {
    label: string;
    icon: string;
    iconColor: number;
    isModified: boolean;
}

// ─── Filler Element ───

class TabStripFillerElement extends TUIElement {
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
        const resolved = this.resolvedStyle;
        for (let x = 0; x < width; x++) {
            context.setCell(x, 0, { char: " ", fg: resolved.fg, bg: resolved.bg });
        }
    }
}

// ─── EditorTabStripElement ───

export class EditorTabStripElement extends TUIElement {
    private hflex: HFlexElement;
    private itemElements: EditorTabItemElement[] = [];
    private filler: TabStripFillerElement;
    private activeIndexValue = -1;

    public activeFg: number = ACTIVE_TAB_FG;
    public activeBg: number = ACTIVE_TAB_BG;
    public inactiveFg: number = INACTIVE_TAB_FG;
    public inactiveBg: number = INACTIVE_TAB_BG;
    public stripBg: number = STRIP_BG;

    public onTabActivate: ((index: number) => void) | null = null;
    public onTabClose: ((index: number) => void) | null = null;

    public constructor() {
        super();
        this.hflex = new HFlexElement();
        this.filler = new TabStripFillerElement();
        this.filler.style = { fg: DEFAULT_COLOR, bg: this.stripBg };
        this.hflex.addChild(this.filler, { width: hflexFill(), height: 1 });
        this.hflex.setParent(this);
    }

    public get activeIndex(): number {
        return this.activeIndexValue;
    }

    public set activeIndex(value: number) {
        if (this.activeIndexValue === value) return;
        this.activeIndexValue = value;
        this.updateItemStyles();
        this.markDirty();
    }

    public getItemElements(): readonly EditorTabItemElement[] {
        return this.itemElements;
    }

    public setTabs(tabs: TabInfo[]): void {
        const newItems: EditorTabItemElement[] = [];

        for (let i = 0; i < tabs.length; i++) {
            const tab = tabs[i];
            let item: EditorTabItemElement;

            if (i < this.itemElements.length) {
                item = this.itemElements[i];
                item.setLabel(tab.label);
                item.setIcon(tab.icon, tab.iconColor);
                item.setModified(tab.isModified);
            } else {
                item = new EditorTabItemElement(tab.label, tab.icon, tab.iconColor, {
                    modified: tab.isModified,
                });
                const index = i;
                item.onActivate = () => this.onTabActivate?.(index);
                item.onClose = () => this.onTabClose?.(index);
            }

            newItems.push(item);
        }

        this.itemElements = newItems;
        this.rebuildHFlex();
        this.updateItemStyles();
        this.markDirty();
    }

    private rebuildHFlex(): void {
        const children: TUIElement[] = [];

        for (const item of this.itemElements) {
            item.layoutStyle = { width: hflexFit(), height: 1 };
            children.push(item);
        }

        this.filler.style = { fg: DEFAULT_COLOR, bg: this.stripBg };
        this.filler.layoutStyle = { width: hflexFill(), height: 1 };
        children.push(this.filler);

        this.hflex.replaceChildren(children);
    }

    private updateItemStyles(): void {
        for (let i = 0; i < this.itemElements.length; i++) {
            const isActive = i === this.activeIndexValue;
            this.itemElements[i].style = {
                fg: isActive ? this.activeFg : this.inactiveFg,
                bg: isActive ? this.activeBg : this.inactiveBg,
            };
        }
    }

    // ─── Children ───

    public override getChildren(): readonly TUIElement[] {
        return [this.hflex];
    }

    // ─── Intrinsic Size ───

    public override getMinIntrinsicWidth(height: number): number {
        return this.hflex.getMinIntrinsicWidth(height);
    }

    public override getMaxIntrinsicWidth(height: number): number {
        return this.hflex.getMaxIntrinsicWidth(height);
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return 1;
    }

    // ─── Layout ───

    public override performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);

        this.hflex.localPosition = new Offset(0, 0);
        this.hflex.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);
        this.hflex.performLayout(BoxConstraints.tight(new Size(containerSize.width, 1)));

        return containerSize;
    }

    // ─── Render ───

    public override render(context: RenderContext): void {
        this.hflex.render(context.withOffset(this.hflex.localPosition));
    }
}
