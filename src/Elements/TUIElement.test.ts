import { describe, it, expect, vi } from "vitest";
import { TUIElement } from "./TUIElement.ts";
import { BoxConstraints, Offset, Point, Size } from "../Common/GeometryPromitives.ts";
import type { KeyPressEvent } from "../TerminalBackend/KeyEvent.ts";

function makeKeyEvent(overrides: Partial<KeyPressEvent> & { type: KeyPressEvent["type"] }): KeyPressEvent {
    return {
        key: "a",
        code: "KeyA",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        raw: "a",
        ...overrides,
    };
}

describe("TUIElement event system", () => {
    it("calls keypress listeners on keypress event", () => {
        const element = new TUIElement();
        const handler = vi.fn();
        element.addEventListener("keypress", handler);

        const event = makeKeyEvent({ type: "keypress" });
        element.emit(event);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(event);
    });

    it("calls keydown listeners on keydown event", () => {
        const element = new TUIElement();
        const handler = vi.fn();
        element.addEventListener("keydown", handler);

        const event = makeKeyEvent({ type: "keydown" });
        element.emit(event);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(event);
    });

    it("calls keyup listeners on keyup event", () => {
        const element = new TUIElement();
        const handler = vi.fn();
        element.addEventListener("keyup", handler);

        const event = makeKeyEvent({ type: "keyup" });
        element.emit(event);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(event);
    });

    it("does not call keypress listeners on keydown event", () => {
        const element = new TUIElement();
        const keypressHandler = vi.fn();
        element.addEventListener("keypress", keypressHandler);

        element.emit(makeKeyEvent({ type: "keydown" }));

        expect(keypressHandler).not.toHaveBeenCalled();
    });

    it("does not crash when emitting event with no listeners", () => {
        const element = new TUIElement();
        expect(() => {
            element.emit(makeKeyEvent({ type: "keypress" }));
            element.emit(makeKeyEvent({ type: "keydown" }));
            element.emit(makeKeyEvent({ type: "keyup" }));
        }).not.toThrow();
    });

    it("supports multiple listeners for the same event type", () => {
        const element = new TUIElement();
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        element.addEventListener("keydown", handler1);
        element.addEventListener("keydown", handler2);

        element.emit(makeKeyEvent({ type: "keydown" }));

        expect(handler1).toHaveBeenCalledOnce();
        expect(handler2).toHaveBeenCalledOnce();
    });

    it("removes a specific listener with removeEventListener", () => {
        const element = new TUIElement();
        const handler = vi.fn();
        element.addEventListener("keydown", handler);
        element.removeEventListener("keydown", handler);

        element.emit(makeKeyEvent({ type: "keydown" }));

        expect(handler).not.toHaveBeenCalled();
    });

    it("removeEventListener does not affect other listeners", () => {
        const element = new TUIElement();
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        element.addEventListener("keypress", handler1);
        element.addEventListener("keypress", handler2);

        element.removeEventListener("keypress", handler1);
        element.emit(makeKeyEvent({ type: "keypress" }));

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).toHaveBeenCalledOnce();
    });

    it("removeEventListener is no-op for unregistered handler", () => {
        const element = new TUIElement();
        const handler = vi.fn();

        expect(() => {
            element.removeEventListener("keyup", handler);
        }).not.toThrow();
    });
});

describe("TUIElement coordinate system", () => {
    it("initializes with default coordinates", () => {
        const element = new TUIElement();
        expect(element.localPosition).toEqual(new Offset(0, 0));
        expect(element.globalPosition).toEqual(new Point(0, 0));
        expect(element.isLayoutDirty).toBe(true);
    });

    it("performLayout returns calculated size", () => {
        const element = new TUIElement();
        const constraints = BoxConstraints.tight(new Size(10, 5));
        const result = element.performLayout(constraints);

        expect(result).toEqual(new Size(10, 5));
    });

    it("performLayout marks element as clean", () => {
        const element = new TUIElement();
        expect(element.isLayoutDirty).toBe(true);

        const constraints = BoxConstraints.tight(new Size(10, 5));
        element.performLayout(constraints);

        expect(element.isLayoutDirty).toBe(false);
    });

    it("lazy size getter triggers performLayout when isDirty", () => {
        const element = new TUIElement();
        const spy = vi.spyOn(element, "performLayout");

        // First access should trigger performLayout
        const size = element.size;

        expect(spy).toHaveBeenCalled();
        expect(size).toEqual(new Size(80, 24)); // default
    });

    it("lazy size getter does not trigger performLayout when clean", () => {
        const element = new TUIElement();
        element.performLayout(BoxConstraints.tight(new Size(10, 5)));
        const spy = vi.spyOn(element, "performLayout");

        const size = element.size;

        expect(spy).not.toHaveBeenCalled();
        expect(size).toEqual(new Size(10, 5));
    });

    it("markDirty sets isLayoutDirty flag", () => {
        const element = new TUIElement();
        element.performLayout(BoxConstraints.tight(new Size(10, 5)));
        expect(element.isLayoutDirty).toBe(false);

        element.markDirty();

        expect(element.isLayoutDirty).toBe(true);
    });

    it("markDirty propagates to parent", () => {
        const parent = new TUIElement();
        const child = new TUIElement();
        child.setParent(parent);

        parent.performLayout(BoxConstraints.tight(new Size(10, 5)));
        expect(parent.isLayoutDirty).toBe(false);

        child.markDirty();

        expect(parent.isLayoutDirty).toBe(true);
    });

    it("markDirty propagates through multiple ancestors", () => {
        const grandparent = new TUIElement();
        const parent = new TUIElement();
        const child = new TUIElement();

        parent.setParent(grandparent);
        child.setParent(parent);

        grandparent.performLayout(BoxConstraints.tight(new Size(10, 5)));
        parent.performLayout(BoxConstraints.tight(new Size(10, 5)));

        expect(grandparent.isLayoutDirty).toBe(false);
        expect(parent.isLayoutDirty).toBe(false);

        child.markDirty();

        expect(parent.isLayoutDirty).toBe(true);
        expect(grandparent.isLayoutDirty).toBe(true);
    });

    it("setParent establishes parent reference", () => {
        const parent = new TUIElement();
        const child = new TUIElement();

        child.setParent(parent);

        // Verify by checking dirty propagation works
        parent.performLayout(BoxConstraints.tight(new Size(10, 5)));
        child.markDirty();

        expect(parent.isLayoutDirty).toBe(true);
    });

    it("setParent(null) removes parent reference", () => {
        const parent = new TUIElement();
        const child = new TUIElement();

        child.setParent(parent);
        child.setParent(null);

        parent.performLayout(BoxConstraints.tight(new Size(10, 5)));
        child.markDirty();

        // Parent should remain clean since child has no parent
        expect(parent.isLayoutDirty).toBe(false);
    });

    it("localPosition reflects relative offset from parent", () => {
        const element = new TUIElement();
        const offset = new Offset(5, 10);
        element.localPosition = offset;

        expect(element.localPosition).toEqual(offset);
    });

    it("globalPosition reflects absolute screen coordinates", () => {
        const element = new TUIElement();
        const point = new Point(15, 20);
        element.globalPosition = point;

        expect(element.globalPosition).toEqual(point);
    });

    it("getCachedSize returns current size without triggering layout", () => {
        const element = new TUIElement();
        element.performLayout(BoxConstraints.tight(new Size(10, 5)));
        const spy = vi.spyOn(element, "performLayout");

        // @ts-expect-error - getCachedSize is protected, but we want to test it directly
        const cached = element.getCachedSize();

        expect(spy).not.toHaveBeenCalled();
        expect(cached).toEqual(new Size(10, 5));
    });

    it("child with null parent does not crash on markDirty", () => {
        const element = new TUIElement();
        element.setParent(null);

        expect(() => {
            element.markDirty();
        }).not.toThrow();
    });

    it("multiple markDirty calls are idempotent", () => {
        const parent1 = new TUIElement();
        const parent2 = new TUIElement();
        const child = new TUIElement();

        child.setParent(parent1);
        parent1.setParent(parent2);

        parent1.performLayout(BoxConstraints.tight(new Size(10, 5)));
        parent2.performLayout(BoxConstraints.tight(new Size(10, 5)));

        child.markDirty();
        child.markDirty();
        child.markDirty();

        // All should be dirty regardless of multiple calls
        expect(child.isLayoutDirty).toBe(true);
        expect(parent1.isLayoutDirty).toBe(true);
        expect(parent2.isLayoutDirty).toBe(true);
    });

    it("lazy getter with loose constraints uses default size", () => {
        const element = new TUIElement();
        const size = element.size; // Should not crash

        expect(size).toEqual(new Size(80, 24)); // default
        expect(element.isLayoutDirty).toBe(false);
    });
});

describe("TUIElement root reference propagation", () => {
    it("setParent propagates root from parent to child", () => {
        const parent = new TUIElement();
        const child = new TUIElement();

        parent.setAsRoot();

        child.setParent(parent);

        expect(child.getRoot()).toBe(parent);
    });

    it("setParent(null) clears root reference", () => {
        const parent = new TUIElement();
        const child = new TUIElement();

        parent.setAsRoot();
        child.setParent(parent);
        expect(child.getRoot()).toBe(parent);

        child.setParent(null);
        expect(child.getRoot()).toBeNull();
    });

    it("nested children all get root reference from grandparent", () => {
        const root = new TUIElement();
        const parent = new TUIElement();
        const child = new TUIElement();

        root.setAsRoot();
        parent.setParent(root);
        child.setParent(parent);

        expect(root.getRoot()).toBe(root);
        expect(parent.getRoot()).toBe(root);
        expect(child.getRoot()).toBe(root);
    });

    it("multiple children of same parent all get same root", () => {
        const root = new TUIElement();
        const child1 = new TUIElement();
        const child2 = new TUIElement();

        root.setAsRoot();
        child1.setParent(root);
        child2.setParent(root);

        expect(child1.getRoot()).toBe(root);
        expect(child2.getRoot()).toBe(root);
        expect(child1.getRoot()).toBe(child2.getRoot());
    });

    it("changing parent updates root reference", () => {
        const root1 = new TUIElement();
        const root2 = new TUIElement();
        const child = new TUIElement();

        root1.setAsRoot();
        root2.setAsRoot();

        child.setParent(root1);
        expect(child.getRoot()).toBe(root1);

        child.setParent(root2);
        expect(child.getRoot()).toBe(root2);
    });
});
