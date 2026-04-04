import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR } from "../../Rendering/ColorUtils.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { PopupMenuItemElement, PopupMenuSeparatorElement } from "./PopupMenuItemElement.ts";
import type { PopupMenuItemConfig } from "./PopupMenuItemElement.ts";
import { VStackElement } from "./VStackElement.ts";

export interface MenuItemEntry {
    type?: "item";
    label: string;
    shortcut?: string;
    icon?: string;
    onSelect?: () => void;
}

export interface MenuSeparatorEntry {
    type: "separator";
}

export type MenuEntry = MenuItemEntry | MenuSeparatorEntry;

function isSeparator(entry: MenuEntry): entry is MenuSeparatorEntry {
    return entry.type === "separator";
}

const BORDER_FG = DEFAULT_COLOR;
const MENU_BG = DEFAULT_COLOR;

export class PopupMenuElement extends TUIElement {
    public readonly entries: MenuEntry[];
    public selectedIndex: number;
    public onClose?: () => void;

    private selectableIndices: number[];
    private vstack: VStackElement;
    private itemElements: PopupMenuItemElement[] = [];

    public constructor(entries: MenuEntry[]) {
        super();
        this.entries = entries;
        this.selectableIndices = entries.map((e, i) => (isSeparator(e) ? -1 : i)).filter((i) => i >= 0);
        this.selectedIndex = this.selectableIndices.length > 0 ? this.selectableIndices[0] : -1;

        const config = this.computeConfig();
        this.vstack = new VStackElement();

        for (const entry of entries) {
            if (isSeparator(entry)) {
                this.vstack.addChild(new PopupMenuSeparatorElement(), { width: "stretch", height: 1 });
            } else {
                const item = new PopupMenuItemElement(entry.label, config, entry.shortcut, entry.icon);
                item.onSelect = entry.onSelect;
                this.itemElements.push(item);
                this.vstack.addChild(item, { width: "stretch", height: 1 });
            }
        }

        this.vstack.setParent(this);
        this.updateItemSelectedStates();

        this.addEventListener("keydown", (event) => {
            if (event.key === "ArrowUp") {
                this.moveSelection(-1);
            } else if (event.key === "ArrowDown") {
                this.moveSelection(1);
            } else if (event.key === "Enter") {
                this.activateSelected();
            } else if (event.key === "Escape") {
                this.onClose?.();
            }
        });
    }

    public override getChildren(): readonly TUIElement[] {
        return [this.vstack];
    }

    public override getMinIntrinsicWidth(_height: number): number {
        return this.getIntrinsicSize().width;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.getIntrinsicSize().width;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return this.getIntrinsicSize().height;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return this.getIntrinsicSize().height;
    }

    public getIntrinsicSize(): Size {
        const innerWidth = this.vstack.getMaxIntrinsicWidth(this.entries.length);
        const totalWidth = 2 + innerWidth; // borders left + right
        const totalHeight = this.entries.length + 2; // border top + entries + border bottom
        return new Size(totalWidth, totalHeight);
    }

    public performLayout(constraints: BoxConstraints): Size {
        const intrinsic = this.getIntrinsicSize();
        const resultSize = constraints.constrain(intrinsic);
        super.performLayout(BoxConstraints.tight(resultSize));

        const innerSize = new Size(resultSize.width - 2, resultSize.height - 2);
        this.vstack.localPosition = new Offset(1, 1);
        this.vstack.globalPosition = new Point(this.globalPosition.x + 1, this.globalPosition.y + 1);
        this.vstack.performLayout(BoxConstraints.tight(innerSize));

        return resultSize;
    }

    public render(context: RenderContext): void {
        const w = this.layoutSize.width;
        const h = this.layoutSize.height;

        // Top border: ┌───┐
        this.drawCell(context, 0, 0, "┌", BORDER_FG, MENU_BG);
        for (let x = 1; x < w - 1; x++) {
            this.drawCell(context, x, 0, "─", BORDER_FG, MENU_BG);
        }
        this.drawCell(context, w - 1, 0, "┐", BORDER_FG, MENU_BG);

        // Side borders and separator T-connectors
        const children = this.vstack.getChildren();
        for (let i = 0; i < children.length; i++) {
            const rowY = 1 + i;
            const child = children[i];

            if (child instanceof PopupMenuSeparatorElement) {
                this.drawCell(context, 0, rowY, "├", BORDER_FG, MENU_BG);
                this.drawCell(context, w - 1, rowY, "┤", BORDER_FG, MENU_BG);
            } else {
                this.drawCell(context, 0, rowY, "│", BORDER_FG, MENU_BG);
                this.drawCell(context, w - 1, rowY, "│", BORDER_FG, MENU_BG);
            }
        }

        // Bottom border: └───┘
        const bottomY = h - 1;
        this.drawCell(context, 0, bottomY, "└", BORDER_FG, MENU_BG);
        for (let x = 1; x < w - 1; x++) {
            this.drawCell(context, x, bottomY, "─", BORDER_FG, MENU_BG);
        }
        this.drawCell(context, w - 1, bottomY, "┘", BORDER_FG, MENU_BG);

        // Render VStack content
        const vstackOffset = new Offset(this.vstack.localPosition.dx, this.vstack.localPosition.dy);
        const vstackClip = new Rect(this.vstack.globalPosition, this.vstack.layoutSize);
        this.vstack.render(context.withOffset(vstackOffset).withClip(vstackClip));
    }

    private drawCell(context: RenderContext, x: number, y: number, char: string, fg: number, bg: number): void {
        context.setCell(x, y, { char, fg, bg });
    }

    private computeConfig(): PopupMenuItemConfig {
        let hasIcon = false;
        let hasShortcuts = false;
        for (const entry of this.entries) {
            if (!isSeparator(entry)) {
                if (entry.icon) hasIcon = true;
                if (entry.shortcut) hasShortcuts = true;
            }
        }
        return { hasIconColumn: hasIcon, hasShortcuts };
    }

    private updateItemSelectedStates(): void {
        let itemIndex = 0;
        for (let i = 0; i < this.entries.length; i++) {
            if (!isSeparator(this.entries[i])) {
                this.itemElements[itemIndex].selected = i === this.selectedIndex;
                itemIndex++;
            }
        }
    }

    private moveSelection(direction: number): void {
        if (this.selectableIndices.length === 0) return;
        const currentPos = this.selectableIndices.indexOf(this.selectedIndex);
        let nextPos = currentPos + direction;
        if (nextPos < 0) nextPos = this.selectableIndices.length - 1;
        if (nextPos >= this.selectableIndices.length) nextPos = 0;
        this.selectedIndex = this.selectableIndices[nextPos];
        this.updateItemSelectedStates();
    }

    private activateSelected(): void {
        if (this.selectedIndex < 0) return;
        const entry = this.entries[this.selectedIndex];
        if (!isSeparator(entry) && entry.onSelect) {
            entry.onSelect();
        }
    }
}
