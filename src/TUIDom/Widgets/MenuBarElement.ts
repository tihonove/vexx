import { BoxConstraints, Offset, Point, Size } from "../../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR, packRgb } from "../../Rendering/ColorUtils.ts";
import { StyleFlags } from "../../Rendering/StyleFlags.ts";
import type { TUIFocusEvent } from "../Events/TUIFocusEvent.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { MenuEntry } from "./PopupMenuElement.ts";
import { PopupMenuElement } from "./PopupMenuElement.ts";

export interface MenuBarItem {
    label: string;
    mnemonic?: string;
    entries: MenuEntry[];
}

interface MenuBarLayoutItem {
    startX: number;
    width: number;
}

const MENU_BAR_FG = DEFAULT_COLOR;
const MENU_BAR_BG = packRgb(64, 64, 64);
const ACTIVE_MENU_FG = packRgb(255, 255, 255);
const ACTIVE_MENU_BG = packRgb(0, 90, 180);

export class MenuBarElement extends TUIElement {
    public readonly items: readonly MenuBarItem[];
    public activeIndex = -1;

    private activeMenu: PopupMenuElement | null = null;
    private layoutItems: MenuBarLayoutItem[] = [];
    private previousFocusedElement: TUIElement | null = null;
    private parentMnemonicHandler: ((event: TUIKeyboardEvent) => void) | null = null;

    public constructor(items: MenuBarItem[]) {
        super();
        this.tabIndex = 0;
        this.items = items;
        this.rebuildLayoutItems();

        this.addEventListener("focus", (event: TUIFocusEvent) => {
            this.previousFocusedElement = event.relatedTarget;
            if (this.activeIndex < 0) {
                this.activeIndex = 0;
            }
            this.markDirty();
        });

        this.addEventListener("blur", () => {
            this.deactivate();
            this.previousFocusedElement = null;
        });

        this.addEventListener("keydown", (event) => {
            if (this.activeIndex < 0) {
                return;
            }

            if (event.key === "Escape") {
                if (this.activeMenu) {
                    this.closePopup();
                } else {
                    const prev = this.previousFocusedElement;
                    this.deactivate();
                    if (prev) {
                        prev.focus();
                    } else {
                        this.blur();
                    }
                }
                return;
            }

            if (event.key === "ArrowLeft") {
                const next = this.wrapIndex(this.activeIndex - 1);
                if (this.activeMenu) {
                    this.openMenu(next);
                } else {
                    this.activeIndex = next;
                    this.markDirty();
                }
                return;
            }

            if (event.key === "ArrowRight") {
                const next = this.wrapIndex(this.activeIndex + 1);
                if (this.activeMenu) {
                    this.openMenu(next);
                } else {
                    this.activeIndex = next;
                    this.markDirty();
                }
                return;
            }

            if (event.key === "ArrowDown" || event.key === "Enter") {
                if (this.activeMenu) {
                    this.forwardToPopup(event);
                } else {
                    this.openMenu(this.activeIndex);
                }
                return;
            }

            if (event.key === "ArrowUp") {
                if (this.activeMenu) {
                    this.forwardToPopup(event);
                }
                return;
            }

            if (this.activeMenu) {
                this.forwardToPopup(event);
                return;
            }
        });
    }

    public override setParent(parent: TUIElement | null): void {
        if (this._parent && this.parentMnemonicHandler) {
            this._parent.removeEventListener("keydown", this.parentMnemonicHandler);
        }

        super.setParent(parent);

        if (parent) {
            this.parentMnemonicHandler = (event: TUIKeyboardEvent) => {
                const match = this.findMnemonicMatch(event);
                if (match >= 0) {
                    this.focus();
                    this.openMenu(match);
                    event.preventDefault();
                }
            };
            parent.addEventListener("keydown", this.parentMnemonicHandler);
        } else {
            this.parentMnemonicHandler = null;
        }
    }

    public override getChildren(): readonly TUIElement[] {
        const children: TUIElement[] = [];
        if (this.activeMenu) children.push(this.activeMenu);
        return children;
    }

    public performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);

        if (this.activeMenu && this.activeIndex >= 0) {
            const menuPosition = this.getMenuPosition(this.activeIndex);
            const availableSize = new Size(
                Math.max(0, containerSize.width - menuPosition.x),
                Math.max(0, containerSize.height - menuPosition.y),
            );
            this.activeMenu.localPosition = new Offset(menuPosition.x, menuPosition.y);
            this.activeMenu.globalPosition = new Point(
                this.globalPosition.x + menuPosition.x,
                this.globalPosition.y + menuPosition.y,
            );
            this.activeMenu.performLayout(BoxConstraints.loose(availableSize));
        }

        return containerSize;
    }

    public render(context: RenderContext): void {
        const width = this.size.width;
        const { dx: ox, dy: oy } = context.offset;

        for (let x = 0; x < width; x++) {
            context.canvas.setCell(new Point(ox + x, oy), { char: " ", fg: MENU_BAR_FG, bg: MENU_BAR_BG });
        }

        for (let index = 0; index < this.items.length; index++) {
            this.renderItem(context, index);
        }

        if (this.activeMenu) {
            this.activeMenu.render(context.withOffset(this.activeMenu.localPosition));
        }
    }

    private renderItem(context: RenderContext, index: number): void {
        const item = this.items[index];
        const layoutItem = this.layoutItems[index];
        const isActive = index === this.activeIndex && this.isFocused;
        const fg = isActive ? ACTIVE_MENU_FG : MENU_BAR_FG;
        const bg = isActive ? ACTIVE_MENU_BG : MENU_BAR_BG;
        const { dx: ox, dy: oy } = context.offset;
        const display = ` ${item.label} `;
        const mnemonicIndex = this.getMnemonicIndex(item);

        for (let offset = 0; offset < display.length; offset++) {
            const displayIndex = offset - 1;
            const style = displayIndex === mnemonicIndex ? StyleFlags.Underline : StyleFlags.None;
            context.canvas.setCell(new Point(ox + layoutItem.startX + offset, oy), {
                char: display[offset],
                fg,
                bg,
                style,
            });
        }
    }

    private rebuildLayoutItems(): void {
        let currentX = 0;
        this.layoutItems = this.items.map((item) => {
            const width = item.label.length + 2;
            const layoutItem = { startX: currentX, width };
            currentX += width;
            return layoutItem;
        });
    }

    private openMenu(index: number): void {
        if (index < 0 || index >= this.items.length) {
            return;
        }

        this.closePopup();

        const wrappedEntries = this.items[index].entries.map((entry) => {
            if (entry.type === "separator") {
                return entry;
            }

            const originalOnSelect = entry.onSelect;
            return {
                ...entry,
                onSelect: () => {
                    originalOnSelect?.();
                    this.deactivate();
                    this.blur();
                },
            };
        });

        this.activeIndex = index;
        this.activeMenu = new PopupMenuElement(wrappedEntries);
        this.activeMenu.setParent(this);
        this.activeMenu.onClose = () => {
            this.closePopup();
        };
        this.markDirty();
    }

    private closePopup(): void {
        if (this.activeMenu) {
            this.activeMenu.setParent(null);
        }
        this.activeMenu = null;
        this.markDirty();
    }

    private deactivate(): void {
        this.closePopup();
        this.activeIndex = -1;
        this.markDirty();
    }

    private forwardToPopup(event: TUIKeyboardEvent): void {
        this.activeMenu?.dispatchEvent(
            new TUIKeyboardEvent("keydown", {
                key: event.key,
                code: event.code,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
                raw: event.raw,
                bubbles: false,
            }),
        );
    }

    private wrapIndex(index: number): number {
        if (this.items.length === 0) {
            return -1;
        }

        if (index < 0) {
            return this.items.length - 1;
        }

        if (index >= this.items.length) {
            return 0;
        }

        return index;
    }

    private findMnemonicMatch(event: TUIKeyboardEvent): number {
        if (!event.altKey || event.ctrlKey || event.metaKey || event.key.length !== 1) {
            return -1;
        }

        const normalizedKey = event.key.toLowerCase();
        return this.items.findIndex((item) => {
            const mnemonic = (item.mnemonic ?? item.label[0] ?? "").toLowerCase();
            return mnemonic === normalizedKey;
        });
    }

    private getMnemonicIndex(item: MenuBarItem): number {
        const mnemonic = (item.mnemonic ?? item.label[0] ?? "").toLowerCase();
        return item.label.toLowerCase().indexOf(mnemonic);
    }

    private getMenuPosition(index: number): Point {
        const layoutItem = this.layoutItems[index];
        return new Point(layoutItem.startX, 1);
    }
}
