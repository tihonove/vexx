import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import type { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { MenuColors, PopupMenuItemConfig } from "./PopupMenuItemElement.tsx";
import { DEFAULT_MENU_COLORS, PopupMenuItemElement, PopupMenuSeparatorElement } from "./PopupMenuItemElement.tsx";
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

export class PopupMenuElement extends TUIElement {
    public readonly entries: MenuEntry[];
    public selectedIndex: number;
    public onClose?: () => void;

    private selectableIndices: number[];
    private vstack: VStackElement;
    private itemElements: PopupMenuItemElement[] = [];
    private separatorElements: PopupMenuSeparatorElement[] = [];
    private colors: MenuColors = DEFAULT_MENU_COLORS;

    public constructor(entries: MenuEntry[]) {
        super();
        this.entries = entries;
        this.selectableIndices = entries.map((e, i) => (isSeparator(e) ? -1 : i)).filter((i) => i >= 0);
        this.selectedIndex = this.selectableIndices.length > 0 ? this.selectableIndices[0] : -1;

        const config = this.computeConfig();
        this.vstack = new VStackElement();

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (isSeparator(entry)) {
                const separator = new PopupMenuSeparatorElement(this.colors);
                this.separatorElements.push(separator);
                this.vstack.addChild(separator, { width: "stretch", height: 1 });
            } else {
                const item = new PopupMenuItemElement(entry.label, config, entry.shortcut, entry.icon, this.colors);
                item.onSelect = entry.onSelect;
                const entryIndex = i;
                item.onHover = () => this.selectByEntryIndex(entryIndex);
                this.itemElements.push(item);
                this.vstack.addChild(item, { width: "stretch", height: 1 });
            }
        }

        this.vstack.setParent(this);
        this.updateItemSelectedStates();
    }

    /**
     * Применяет цвета из активной темы (ключи VS Code `menu.*`). `menu.*` цвета
     * гарантированы реестром дефолтов (см. {@link defaultWorkbenchColors}), а
     * `shortcutFg` не имеет темизируемого ключа VS Code и берётся из
     * {@link DEFAULT_MENU_COLORS} (baseline для меню без темы).
     */
    public applyTheme(theme: WorkbenchTheme): void {
        this.colors = {
            fg: theme.getRequiredColor("menu.foreground"),
            bg: theme.getRequiredColor("menu.background"),
            highlightFg: theme.getRequiredColor("menu.selectionForeground"),
            highlightBg: theme.getRequiredColor("menu.selectionBackground"),
            shortcutFg: DEFAULT_MENU_COLORS.shortcutFg,
            borderFg: theme.getRequiredColor("menu.border"),
            separatorFg: theme.getRequiredColor("menu.separatorBackground"),
        };
        for (const item of this.itemElements) {
            item.colors = this.colors;
        }
        for (const separator of this.separatorElements) {
            separator.colors = this.colors;
        }
        this.markDirty();
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
        const borderFg = this.colors.borderFg;
        const bg = this.colors.bg;

        // Frame with T-connectors on separator rows (├───┤).
        const children = this.vstack.getChildren();
        const separators: number[] = [];
        for (let i = 0; i < children.length; i++) {
            if (children[i] instanceof PopupMenuSeparatorElement) separators.push(1 + i);
        }
        context.drawBox(0, 0, w, h, { fg: borderFg, bg, separators });

        // Render VStack content
        const vstackOffset = new Offset(this.vstack.localPosition.dx, this.vstack.localPosition.dy);
        const vstackClip = new Rect(this.vstack.globalPosition, this.vstack.layoutSize);
        this.vstack.render(context.withOffset(vstackOffset).withClip(vstackClip));
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

    protected override performDefaultAction(event: TUIEventBase): void {
        if (event.type === "keydown") {
            const keyEvent = event as TUIKeyboardEvent;
            if (keyEvent.key === "ArrowUp") {
                this.moveSelection(-1);
            } else if (keyEvent.key === "ArrowDown") {
                this.moveSelection(1);
            } else if (keyEvent.key === "Enter") {
                this.activateSelected();
            } else if (keyEvent.key === "Escape") {
                this.onClose?.();
            }
        }
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

    /**
     * Moves the selection onto the item at the given entry index. Only called
     * from item hover callbacks, so `index` is always a selectable entry.
     */
    private selectByEntryIndex(index: number): void {
        if (index === this.selectedIndex) return;
        this.selectedIndex = index;
        this.updateItemSelectedStates();
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
