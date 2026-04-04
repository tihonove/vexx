import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR, packRgb } from "../../Rendering/ColorUtils.ts";
import { StyleFlags } from "../../Rendering/StyleFlags.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

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

const HIGHLIGHT_BG = packRgb(0, 90, 180);
const HIGHLIGHT_FG = packRgb(255, 255, 255);
const MENU_FG = DEFAULT_COLOR;
const MENU_BG = DEFAULT_COLOR;
const BORDER_FG = DEFAULT_COLOR;
const SHORTCUT_FG = packRgb(128, 128, 128);

export class PopupMenuElement extends TUIElement {
    public readonly entries: MenuEntry[];
    public selectedIndex: number;
    public onClose?: () => void;

    private selectableIndices: number[];

    public constructor(entries: MenuEntry[]) {
        super();
        this.entries = entries;
        this.selectableIndices = entries.map((e, i) => (isSeparator(e) ? -1 : i)).filter((i) => i >= 0);
        this.selectedIndex = this.selectableIndices.length > 0 ? this.selectableIndices[0] : -1;

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
        let maxLabelWidth = 0;
        let maxShortcutWidth = 0;
        let hasIcon = false;

        for (const entry of this.entries) {
            if (!isSeparator(entry)) {
                maxLabelWidth = Math.max(maxLabelWidth, entry.label.length);
                if (entry.shortcut) {
                    maxShortcutWidth = Math.max(maxShortcutWidth, entry.shortcut.length);
                }
                if (entry.icon) {
                    hasIcon = true;
                }
            }
        }

        const iconPart = hasIcon ? 2 : 0; // "X " — icon char + space
        const leftPad = hasIcon ? 0 : 1; // icon replaces left padding
        const rightPad = 1;
        const gapPart = maxShortcutWidth > 0 ? 2 : 0; // gap between label and shortcut
        const contentWidth = iconPart + maxLabelWidth + gapPart + maxShortcutWidth;
        const totalWidth = 1 + leftPad + contentWidth + rightPad + 1; // border + pad + content + pad + border
        const totalHeight = this.entries.length + 2; // border top + entries + border bottom

        return new Size(totalWidth, totalHeight);
    }

    public performLayout(constraints: BoxConstraints): Size {
        const intrinsic = this.getIntrinsicSize();
        const resultSize = constraints.constrain(intrinsic);
        // Use parent's mechanism to store size
        return super.performLayout(BoxConstraints.tight(resultSize));
    }

    public render(context: RenderContext): void {
        const w = this.layoutSize.width;
        const h = this.layoutSize.height;

        // Compute column layout
        let hasIcon = false;
        let maxShortcutWidth = 0;
        for (const entry of this.entries) {
            if (!isSeparator(entry)) {
                if (entry.icon) hasIcon = true;
                if (entry.shortcut) {
                    maxShortcutWidth = Math.max(maxShortcutWidth, entry.shortcut.length);
                }
            }
        }
        const iconCols = hasIcon ? 2 : 0;
        const innerWidth = w - 2; // minus borders

        // Top border: ┌───┐
        this.drawCell(context, 0, 0, "┌", BORDER_FG, MENU_BG);
        for (let x = 1; x < w - 1; x++) {
            this.drawCell(context, x, 0, "─", BORDER_FG, MENU_BG);
        }
        this.drawCell(context, w - 1, 0, "┐", BORDER_FG, MENU_BG);

        // Entries
        for (let i = 0; i < this.entries.length; i++) {
            const rowY = 1 + i;
            const entry = this.entries[i];

            if (isSeparator(entry)) {
                // ├───┤
                this.drawCell(context, 0, rowY, "├", BORDER_FG, MENU_BG);
                for (let x = 1; x < w - 1; x++) {
                    this.drawCell(context, x, rowY, "─", BORDER_FG, MENU_BG);
                }
                this.drawCell(context, w - 1, rowY, "┤", BORDER_FG, MENU_BG);
            } else {
                const isSelected = i === this.selectedIndex;
                const fg = isSelected ? HIGHLIGHT_FG : MENU_FG;
                const bg = isSelected ? HIGHLIGHT_BG : MENU_BG;

                this.drawCell(context, 0, rowY, "│", BORDER_FG, MENU_BG);

                // Fill inner area with bg
                for (let x = 0; x < innerWidth; x++) {
                    this.drawCell(context, 1 + x, rowY, " ", fg, bg);
                }

                // Icon
                let col = hasIcon ? 1 : 2; // after border; with icon it replaces the pad space
                if (hasIcon) {
                    const iconChar = entry.icon ?? " ";
                    this.drawCell(context, col, rowY, iconChar, fg, bg);
                    col += iconCols;
                }

                // Label
                for (let c = 0; c < entry.label.length; c++) {
                    this.drawCell(context, col + c, rowY, entry.label[c], fg, bg);
                }

                // Shortcut (right-aligned, ending right before the border)
                if (entry.shortcut && maxShortcutWidth > 0) {
                    const shortcutStart = w - 1 - entry.shortcut.length;
                    const sFg = isSelected ? HIGHLIGHT_FG : SHORTCUT_FG;
                    for (let c = 0; c < entry.shortcut.length; c++) {
                        this.drawCell(context, shortcutStart + c, rowY, entry.shortcut[c], sFg, bg);
                    }
                }

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
    }

    private drawCell(context: RenderContext, x: number, y: number, char: string, fg: number, bg: number): void {
        context.setCell(x, y, { char, fg, bg });
    }

    private moveSelection(direction: number): void {
        if (this.selectableIndices.length === 0) return;
        const currentPos = this.selectableIndices.indexOf(this.selectedIndex);
        let nextPos = currentPos + direction;
        if (nextPos < 0) nextPos = this.selectableIndices.length - 1;
        if (nextPos >= this.selectableIndices.length) nextPos = 0;
        this.selectedIndex = this.selectableIndices[nextPos];
    }

    private activateSelected(): void {
        if (this.selectedIndex < 0) return;
        const entry = this.entries[this.selectedIndex];
        if (!isSeparator(entry) && entry.onSelect) {
            entry.onSelect();
        }
    }
}
