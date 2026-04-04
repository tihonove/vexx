import { describe, expect, it, vi } from "vitest";

import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { TUIElement } from "../TUIElement.ts";

import type { PopupMenuItemConfig } from "./PopupMenuItemElement.tsx";
import { PopupMenuItemElement } from "./PopupMenuItemElement.tsx";

const simpleConfig: PopupMenuItemConfig = { hasIconColumn: false, hasShortcuts: false };

function fireClickOn(el: TUIElement): void {
    el.dispatchEvent(
        new TUIMouseEvent("click", { button: "left", screenX: 0, screenY: 0, localX: 0, localY: 0 }),
    );
}

function findDeepestChild(el: TUIElement): TUIElement {
    const children = el.getChildren();
    if (children.length === 0) return el;
    return findDeepestChild(children[0]);
}

describe("PopupMenuItemElement", () => {
    describe("click handling", () => {
        it("calls onSelect when click dispatched on element itself", () => {
            const item = new PopupMenuItemElement("Cut", simpleConfig);
            item.setAsRoot();
            const handler = vi.fn();
            item.onSelect = handler;

            fireClickOn(item);

            expect(handler).toHaveBeenCalledOnce();
        });

        it("calls onSelect when click dispatched on child (bubbling)", () => {
            const item = new PopupMenuItemElement("Cut", simpleConfig);
            item.setAsRoot();
            const handler = vi.fn();
            item.onSelect = handler;

            const deepChild = findDeepestChild(item);
            fireClickOn(deepChild);

            expect(handler).toHaveBeenCalledOnce();
        });

        it("does not call onSelect when event is defaultPrevented", () => {
            const item = new PopupMenuItemElement("Cut", simpleConfig);
            item.setAsRoot();
            const handler = vi.fn();
            item.onSelect = handler;

            const event = new TUIMouseEvent("click", {
                button: "left", screenX: 0, screenY: 0, localX: 0, localY: 0,
            });
            event.preventDefault();
            item.dispatchEvent(event);

            expect(handler).not.toHaveBeenCalled();
        });

        it("calls onSelect set after construction", () => {
            const item = new PopupMenuItemElement("Cut", simpleConfig);
            item.setAsRoot();

            const handler = vi.fn();
            item.onSelect = handler;

            fireClickOn(item);

            expect(handler).toHaveBeenCalledOnce();
        });
    });
});
