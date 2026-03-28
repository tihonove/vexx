import { BoxConstraints, Offset, Point, Size } from "../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR, packRgb } from "../Rendering/ColorUtils.ts";
import { StyleFlags } from "../Rendering/StyleFlags.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import type { MenuEntry } from "./PopupMenuElement.ts";
import { PopupMenuElement } from "./PopupMenuElement.ts";
import { RenderContext, TUIElement } from "./TUIElement.ts";

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
const MENU_BAR_BG = packRgb(210, 210, 210);
const ACTIVE_MENU_FG = packRgb(255, 255, 255);
const ACTIVE_MENU_BG = packRgb(0, 90, 180);

export class MenuBarElement extends TUIElement {
    public readonly items: readonly MenuBarItem[];
    public activeIndex = -1;

    private content: TUIElement | null = null;
    private activeMenu: PopupMenuElement | null = null;
    private layoutItems: MenuBarLayoutItem[] = [];

    public constructor(items: MenuBarItem[]) {
        super();
        this.items = items;
        this.rebuildLayoutItems();

        this.addEventListener("keydown", (event) => {
            const mnemonicMatch = this.findMnemonicMatch(event);
            if (mnemonicMatch >= 0) {
                this.openMenu(mnemonicMatch);
                return;
            }

            if (this.activeIndex < 0) {
                this.content?.dispatchEvent(
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
                return;
            }

            if (event.key === "ArrowLeft") {
                this.openMenu(this.wrapIndex(this.activeIndex - 1));
                return;
            }

            if (event.key === "ArrowRight") {
                this.openMenu(this.wrapIndex(this.activeIndex + 1));
                return;
            }

            if (event.key === "Escape") {
                this.closeMenu();
                return;
            }

            if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Enter") {
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
                return;
            }

            if (this.activeMenu) {
                this.activeMenu.dispatchEvent(
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
                return;
            }

            this.content?.dispatchEvent(
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
        });
    }

    public setContent(element: TUIElement): void {
        this.content = element;
        this.content.setParent(this);
    }

    public override getChildren(): readonly TUIElement[] {
        const children: TUIElement[] = [];
        if (this.content) children.push(this.content);
        if (this.activeMenu) children.push(this.activeMenu);
        return children;
    }

    public performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);

        if (this.content) {
            const contentSize = new Size(containerSize.width, Math.max(0, containerSize.height - 1));
            this.content.localPosition = new Offset(0, 1);
            this.content.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y + 1);
            this.content.performLayout(BoxConstraints.tight(contentSize));
        }

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

        if (this.content) {
            this.content.render(context.withOffset(this.content.localPosition));
        }

        if (this.activeMenu) {
            this.activeMenu.render(context.withOffset(this.activeMenu.localPosition));
        }
    }

    private renderItem(context: RenderContext, index: number): void {
        const item = this.items[index];
        const layoutItem = this.layoutItems[index];
        const isActive = index === this.activeIndex;
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

        const wrappedEntries = this.items[index].entries.map((entry) => {
            if (entry.type === "separator") {
                return entry;
            }

            const originalOnSelect = entry.onSelect;
            return {
                ...entry,
                onSelect: () => {
                    originalOnSelect?.();
                    this.closeMenu();
                },
            };
        });

        this.activeIndex = index;
        this.activeMenu = new PopupMenuElement(wrappedEntries);
        this.activeMenu.setParent(this);
        this.activeMenu.onClose = () => {
            this.closeMenu();
        };
        this.markDirty();
    }

    private closeMenu(): void {
        if (this.activeMenu) {
            this.activeMenu.setParent(null);
        }
        this.activeMenu = null;
        this.activeIndex = -1;
        this.markDirty();
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
