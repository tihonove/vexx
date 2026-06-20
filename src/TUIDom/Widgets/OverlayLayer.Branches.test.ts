import { describe, expect, it, vi } from "vitest";

import { Point, Size } from "../../Common/GeometryPromitives.ts";
import { TestApp } from "../../TestUtils/TestApp.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { TUIElement } from "../TUIElement.ts";

import { OverlayLayer } from "./OverlayLayer.ts";
import { InputElement } from "./InputElement.ts";
import { PopupMenuElement } from "./PopupMenuElement.ts";

describe("OverlayLayer — item mutation guards", () => {
    it("removeItem is a no-op when the element is neither a session nor an item", () => {
        const layer = new OverlayLayer();
        const stranger = new TUIElement();

        // No session and not in items → both guards (session + findIndex) fall through.
        expect(() => layer.removeItem(stranger)).not.toThrow();
        expect(layer.getItems().length).toBe(0);
    });

    it("setVisible is a no-op for an element that is not an item", () => {
        const layer = new OverlayLayer();
        const stranger = new TUIElement();

        layer.setVisible(stranger, true);
        expect(layer.hasVisibleItems()).toBe(false);
    });

    it("setPosition is a no-op for an element that is not an item", () => {
        const layer = new OverlayLayer();
        const stranger = new TUIElement();

        // Element not present → no item found, nothing to reposition.
        expect(() => layer.setPosition(stranger, new Point(3, 3))).not.toThrow();
        expect(layer.getItems().length).toBe(0);
    });
});

describe("OverlayLayer — createSession option defaults", () => {
    it("defaults visible to false when the option is omitted", () => {
        const input = new InputElement();
        const app = TestApp.createWithContent(input, new Size(30, 10));
        const layer = app.root.overlayLayer;

        const menu = new PopupMenuElement([{ label: "Copy" }]);
        // No `visible` option → `options.visible ?? false` falls back to false.
        const session = layer.createSession(menu, new Point(2, 2), {});

        expect(session.isOpen()).toBe(false);
        expect(layer.hasVisibleItems()).toBe(false);
    });
});

describe("OverlayLayer — disposed handle guards", () => {
    it("open/close/setPosition do nothing once the session is disposed", () => {
        const input = new InputElement();
        const app = TestApp.createWithContent(input, new Size(30, 10));
        const layer = app.root.overlayLayer;

        const menu = new PopupMenuElement([{ label: "Copy" }]);
        const session = layer.createSession(menu, new Point(2, 2), { visible: false });
        session.dispose();

        expect(() => {
            session.open();
            session.close();
            session.setPosition(new Point(5, 5));
        }).not.toThrow();

        // The element is gone and nothing was re-added.
        expect(layer.getItems().length).toBe(0);
        expect(session.isOpen()).toBe(false);
    });
});

describe("OverlayLayer — live handle setPosition", () => {
    it("repositions the menu through the handle while the session is alive", () => {
        const input = new InputElement();
        const app = TestApp.createWithContent(input, new Size(30, 10));
        const layer = app.root.overlayLayer;

        const menu = new PopupMenuElement([{ label: "Copy" }]);
        const session = layer.createSession(menu, new Point(1, 1), { visible: true });

        session.setPosition(new Point(6, 4));
        app.render();

        const item = layer.getItems().find((i) => i.element === menu);
        expect(item?.position.x).toBe(6);
        expect(item?.position.y).toBe(4);
    });
});

describe("OverlayLayer — computeAnchorPosition preferBelow", () => {
    it("places the menu at the anchor row when preferBelow is false", () => {
        const input = new InputElement();
        const app = TestApp.createWithContent(input, new Size(40, 12));
        const layer = app.root.overlayLayer;

        const menu = new PopupMenuElement([{ label: "Item" }]);
        const position = layer.computeAnchorPosition(menu, {
            screenX: 2,
            screenY: 4,
            preferBelow: false,
        });

        // preferBelow false → py = screenY (no +1 shift below the anchor).
        expect(position.y).toBe(4);
        expect(position.x).toBe(2);
    });
});

describe("OverlayLayer — restoreFocus without a focus manager", () => {
    it("opens and closes safely when the layer has no root/focus manager", () => {
        // A detached layer: getRoot()/focusManager are null, exercising the
        // `root?.focusManager ?? null` fallback in both open and close.
        const layer = new OverlayLayer();
        const menu = new PopupMenuElement([{ label: "Copy" }]);

        const session = layer.createSession(menu, new Point(0, 0), {
            restoreFocus: true,
        });

        expect(() => {
            session.open();
            expect(session.isOpen()).toBe(true);
            session.close();
        }).not.toThrow();
        expect(session.isOpen()).toBe(false);
    });
});

describe("OverlayLayer — disposeOnClose", () => {
    it("disposes the session automatically when it closes", () => {
        const input = new InputElement();
        const app = TestApp.createWithContent(input, new Size(30, 10));
        const layer = app.root.overlayLayer;

        const menu = new PopupMenuElement([{ label: "Copy" }]);
        const onClose = vi.fn();
        const session = layer.createSession(menu, new Point(1, 1), {
            visible: true,
            disposeOnClose: true,
            onClose,
        });

        expect(session.isOpen()).toBe(true);

        session.close();

        expect(onClose).toHaveBeenCalledOnce();
        // disposeOnClose → the item is removed and the handle reads as disposed.
        expect(session.isDisposed).toBe(true);
        expect(layer.getItems().length).toBe(0);
    });
});

describe("OverlayLayer — root listener guards", () => {
    it("ignores a non-Escape key on the root while a closeOnEscape session is open", () => {
        const input = new InputElement();
        const app = TestApp.createWithContent(input, new Size(30, 10));
        const layer = app.root.overlayLayer;

        const menu = new PopupMenuElement([{ label: "Copy" }]);
        menu.tabIndex = 0;
        const session = layer.createSession(menu, new Point(3, 1), {
            visible: true,
            closeOnEscape: true,
        });

        expect(session.isOpen()).toBe(true);

        // Non-Escape key → handler returns early, session stays open.
        app.root.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));
        expect(session.isOpen()).toBe(true);

        // Escape still closes it.
        app.root.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Escape" }));
        expect(session.isOpen()).toBe(false);
    });

    it("keeps the session open when the pointer press lands inside the menu", () => {
        const input = new InputElement();
        const app = TestApp.createWithContent(input, new Size(30, 10));
        const layer = app.root.overlayLayer;

        const menu = new PopupMenuElement([{ label: "Copy" }, { label: "Paste" }]);
        menu.tabIndex = 0;
        const session = layer.createSession(menu, new Point(2, 2), {
            visible: true,
            closeOnOutsidePointer: true,
        });
        app.render();

        expect(session.isOpen()).toBe(true);

        // A mousedown whose target is inside the menu → isInsideElement true → no close.
        menu.dispatchEvent(
            new TUIMouseEvent("mousedown", {
                button: "left",
                screenX: 3,
                screenY: 3,
                localX: 1,
                localY: 1,
            }),
        );
        expect(session.isOpen()).toBe(true);

        // An outside press still closes it.
        input.dispatchEvent(
            new TUIMouseEvent("mousedown", {
                button: "left",
                screenX: 0,
                screenY: 0,
                localX: 0,
                localY: 0,
            }),
        );
        expect(session.isOpen()).toBe(false);
    });
});

describe("OverlayLayer — elementFromPoint miss", () => {
    it("returns null when the point is inside an item's bounds but the child reports no hit", () => {
        const input = new InputElement();
        const app = TestApp.createWithContent(input, new Size(30, 10));
        const layer = app.root.overlayLayer;

        // A visible item whose own elementFromPoint always misses.
        const child = new TUIElement();
        child.elementFromPoint = (): TUIElement | null => null;
        layer.addItem(child, new Point(1, 1), true);
        app.render();

        const bounds = child.layoutSize;
        // Pick a point inside the item rect; child.elementFromPoint returns null → overall null.
        const inside = new Point(child.globalPosition.x + Math.min(0, bounds.width), child.globalPosition.y);
        expect(layer.elementFromPoint(inside)).toBeNull();
    });
});
