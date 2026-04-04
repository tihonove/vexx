import { BoxConstraints, Offset, Point, Size } from "../../Common/GeometryPromitives.ts";
import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import type { TUIFocusEvent } from "../Events/TUIFocusEvent.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { BodyElement } from "./BodyElement.ts";
import type { ContextMenuLayer } from "./ContextMenuLayer.ts";
import { HFlexElement, hflexFill, hflexFit } from "./HFlexElement.ts";
import { MenuBarFillerElement, MenuBarItemElement } from "./MenuBarItemElement.tsx";
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
        this.itemElements = items.map((item, index) => {
            const el = new MenuBarItemElement(item.label, item.mnemonic);
            el.onActivate = () => {
                if (this.activeMenu && this.activeIndex === index) {
                    this.closePopup();
                } else {
                    this.focus();
                    this.openMenu(index);
                }
            };
            this.hflex.addChild(el, { width: hflexFit(), height: 1 });
            return el;
        });
        this.hflex.addChild(new MenuBarFillerElement(), { width: hflexFill(), height: 1 });
        this.hflex.setParent(this);


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
        return [this.hflex];
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

    public performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);

        this.hflex.localPosition = new Offset(0, 0);
        this.hflex.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);
        this.hflex.performLayout(BoxConstraints.tight(new Size(containerSize.width, 1)));

        return containerSize;
    }

    public render(context: RenderContext): void {
        this.hflex.render(context.withOffset(this.hflex.localPosition));
    }

    protected override performDefaultAction(event: TUIEventBase): void {
        if (event.type === "focus") {
            this.previousFocusedElement = (event as TUIFocusEvent).relatedTarget;
            if (this.activeIndex < 0) {
                this.activeIndex = 0;
            }
            this.updateItemActiveStates();
            this.markDirty();
        } else if (event.type === "blur") {
            this.deactivate();
            this.previousFocusedElement = null;
        } else if (event.type === "keydown") {
            this.handleKeydownDefault(event as TUIKeyboardEvent);
        }
    }

    private handleKeydownDefault(event: TUIKeyboardEvent): void {
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
        this.activeMenu.onClose = () => {
            this.closePopup();
        };

        const layer = this.getOverlayLayer();
        const position = this.getMenuGlobalPosition(index);
        layer.addItem(this.activeMenu, position, true);
        this.markDirty();
    }

    private closePopup(): void {
        if (this.activeMenu) {
            const layer = this.getOverlayLayer();
            layer.removeItem(this.activeMenu);
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

    private getMenuGlobalPosition(index: number): Point {
        const el = this.itemElements[index];
        return new Point(this.globalPosition.x + el.localPosition.dx, this.globalPosition.y + 1);
    }

    private getOverlayLayer(): ContextMenuLayer {
        return (this.getRoot() as BodyElement).contextMenuLayer;
    }
}
