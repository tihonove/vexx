import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import type { TUIFocusEvent } from "../Events/TUIFocusEvent.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { HFlexElement, hflexFill, hflexFit } from "./HFlexElement.ts";
import { MenuBarFillerElement, MenuBarItemElement } from "./MenuBarItemElement.ts";
import type { MenuEntry } from "./PopupMenuElement.ts";
import { PopupMenuElement } from "./PopupMenuElement.ts";

export interface MenuBarItem {
    label: string;
    mnemonic?: string;
    entries: MenuEntry[];
}

export class MenuBarElement extends TUIElement {
    public readonly items: readonly MenuBarItem[];
    public activeIndex = -1;

    private activeMenu: PopupMenuElement | null = null;
    private itemElements: MenuBarItemElement[] = [];
    private hflex: HFlexElement;
    private previousFocusedElement: TUIElement | null = null;
    private parentMnemonicHandler: ((event: TUIKeyboardEvent) => void) | null = null;

    private updateItemActiveStates(): void {
        for (let i = 0; i < this.itemElements.length; i++) {
            this.itemElements[i].active = i === this.activeIndex && this.isFocused;
        }
    }

    public constructor(items: MenuBarItem[]) {
        super();
        this.tabIndex = 0;
        this.items = items;

        this.hflex = new HFlexElement();
        this.itemElements = items.map((item) => {
            const el = new MenuBarItemElement(item.label, item.mnemonic);
            this.hflex.addChild(el, { width: hflexFit(), height: 1 });
            return el;
        });
        this.hflex.addChild(new MenuBarFillerElement(), { width: hflexFill(), height: 1 });
        this.hflex.setParent(this);

        this.addEventListener("focus", (event: TUIFocusEvent) => {
            this.previousFocusedElement = event.relatedTarget;
            if (this.activeIndex < 0) {
                this.activeIndex = 0;
            }
            this.updateItemActiveStates();
            this.markDirty();
        });

        this.addEventListener("blur", () => {
            this.deactivate();
            this.previousFocusedElement = null;
        });

        this.addEventListener("click", (event) => {
            const clickedIndex = this.findItemAtX(event.localX);
            if (clickedIndex < 0) return;

            if (this.activeMenu && this.activeIndex === clickedIndex) {
                this.closePopup();
            } else {
                this.focus();
                this.openMenu(clickedIndex);
            }
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
                    this.updateItemActiveStates();
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
                    this.updateItemActiveStates();
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
        const children: TUIElement[] = [this.hflex];
        if (this.activeMenu) children.push(this.activeMenu);
        return children;
    }

    public get isMenuOpen(): boolean {
        return this.activeMenu !== null;
    }

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

    public override elementFromPoint(point: Point): TUIElement | null {
        const bounds = new Rect(this.globalPosition, this.layoutSize);
        if (!bounds.containsPoint(point)) return null;

        if (this.activeMenu) {
            const hit = this.activeMenu.elementFromPoint(point);
            if (hit) return hit;
        }

        return this;
    }

    public performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);

        this.hflex.localPosition = new Offset(0, 0);
        this.hflex.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);
        this.hflex.performLayout(BoxConstraints.tight(new Size(containerSize.width, 1)));

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
        this.hflex.render(context.withOffset(this.hflex.localPosition));

        if (this.activeMenu) {
            this.activeMenu.render(context.withOffset(this.activeMenu.localPosition));
        }
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
        this.updateItemActiveStates();
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
        this.updateItemActiveStates();
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
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const mnemonic = (item.mnemonic ?? item.label[0] ?? "").toLowerCase();
            return mnemonic === normalizedKey;
        });
    }

    private findItemAtX(x: number): number {
        for (let i = 0; i < this.itemElements.length; i++) {
            const el = this.itemElements[i];
            const startX = el.localPosition.dx;
            const width = el.layoutSize.width;
            if (x >= startX && x < startX + width) {
                return i;
            }
        }
        return -1;
    }

    private getMenuPosition(index: number): Point {
        const el = this.itemElements[index];
        return new Point(el.localPosition.dx, 1);
    }
}
