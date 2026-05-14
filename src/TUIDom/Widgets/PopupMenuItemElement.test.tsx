import { describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { PopupMenuItemConfig } from "./PopupMenuItemElement.tsx";
import { PopupMenuItemElement } from "./PopupMenuItemElement.tsx";

function renderItem(item: PopupMenuItemElement, width?: number): string {
    const intrinsicWidth = width ?? item.getMaxIntrinsicWidth(1);
    const size = new Size(intrinsicWidth, 1);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    item.globalPosition = new Point(0, 0);
    item.performLayout(BoxConstraints.tight(size));
    item.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend.getTextAt(new Point(0, 0), intrinsicWidth);
}

const simpleConfig: PopupMenuItemConfig = { hasIconColumn: false, hasShortcuts: false };
const shortcutConfig: PopupMenuItemConfig = { hasIconColumn: false, hasShortcuts: true };

function fireClickOn(el: TUIElement): void {
    el.dispatchEvent(new TUIMouseEvent("click", { button: "left", screenX: 0, screenY: 0, localX: 0, localY: 0 }));
}

function findDeepestChild(el: TUIElement): TUIElement {
    const children = el.getChildren();
    if (children.length === 0) return el;
    return findDeepestChild(children[0]);
}

describe("PopupMenuItemElement", () => {
    describe("rendering", () => {
        it("ends with trailing space when shortcut is present", () => {
            const item = new PopupMenuItemElement("Cut", shortcutConfig, "Ctrl+K");
            const text = renderItem(item);
            expect(text.endsWith(" ")).toBe(true);
            expect(text.endsWith("K")).toBe(false);
        });

        it("ends with trailing space when no shortcut", () => {
            const item = new PopupMenuItemElement("Cut", simpleConfig);
            const text = renderItem(item);
            expect(text.endsWith(" ")).toBe(true);
        });
    });

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
                button: "left",
                screenX: 0,
                screenY: 0,
                localX: 0,
                localY: 0,
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
