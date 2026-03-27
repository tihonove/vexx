import { describe, it, expect, vi } from "vitest";
import { TUIElement } from "./TUIElement.ts";
import { BoxConstraints, Offset, Point, Size } from "../Common/GeometryPromitives.ts";
import type { KeyPressEvent } from "../TerminalBackend/KeyEvent.ts";
import { TUIEventBase, EventPhase } from "../Events/TUIEventBase.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { FocusManager } from "../Events/FocusManager.ts";

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

describe("TUIElement legacy event system", () => {
    it("calls keypress listeners on keypress event", () => {
        const element = new TUIElement();
        const handler = vi.fn();
        element.addLegacyEventListener("keypress", handler);

        const event = makeKeyEvent({ type: "keypress" });
        element.emit(event);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(event);
    });

    it("calls keydown listeners on keydown event", () => {
        const element = new TUIElement();
        const handler = vi.fn();
        element.addLegacyEventListener("keydown", handler);

        const event = makeKeyEvent({ type: "keydown" });
        element.emit(event);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(event);
    });

    it("calls keyup listeners on keyup event", () => {
        const element = new TUIElement();
        const handler = vi.fn();
        element.addLegacyEventListener("keyup", handler);

        const event = makeKeyEvent({ type: "keyup" });
        element.emit(event);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(event);
    });

    it("does not call keypress listeners on keydown event", () => {
        const element = new TUIElement();
        const keypressHandler = vi.fn();
        element.addLegacyEventListener("keypress", keypressHandler);

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
        element.addLegacyEventListener("keydown", handler1);
        element.addLegacyEventListener("keydown", handler2);

        element.emit(makeKeyEvent({ type: "keydown" }));

        expect(handler1).toHaveBeenCalledOnce();
        expect(handler2).toHaveBeenCalledOnce();
    });

    it("removes a specific listener with removeLegacyEventListener", () => {
        const element = new TUIElement();
        const handler = vi.fn();
        element.addLegacyEventListener("keydown", handler);
        element.removeLegacyEventListener("keydown", handler);

        element.emit(makeKeyEvent({ type: "keydown" }));

        expect(handler).not.toHaveBeenCalled();
    });

    it("removeLegacyEventListener does not affect other listeners", () => {
        const element = new TUIElement();
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        element.addLegacyEventListener("keypress", handler1);
        element.addLegacyEventListener("keypress", handler2);

        element.removeLegacyEventListener("keypress", handler1);
        element.emit(makeKeyEvent({ type: "keypress" }));

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).toHaveBeenCalledOnce();
    });

    it("removeLegacyEventListener is no-op for unregistered handler", () => {
        const element = new TUIElement();
        const handler = vi.fn();

        expect(() => {
            element.removeLegacyEventListener("keyup", handler);
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

// ─── Helper: container element with explicit children ───

class ContainerElement extends TUIElement {
    private _children: TUIElement[] = [];

    addChild(child: TUIElement): void {
        child.setParent(this);
        this._children.push(child);
    }

    public override getChildren(): readonly TUIElement[] {
        return this._children;
    }
}

function buildTree(): { root: ContainerElement; parent: ContainerElement; child: TUIElement } {
    const root = new ContainerElement();
    root.setAsRoot();
    const parent = new ContainerElement();
    root.addChild(parent);
    const child = new TUIElement();
    parent.addChild(child);
    return { root, parent, child };
}

// ─── New event system tests ───

describe("TUIElement.getChildren", () => {
    it("returns empty array by default", () => {
        const el = new TUIElement();
        expect(el.getChildren()).toEqual([]);
    });

    it("ContainerElement returns added children", () => {
        const container = new ContainerElement();
        const child1 = new TUIElement();
        const child2 = new TUIElement();
        container.addChild(child1);
        container.addChild(child2);
        expect(container.getChildren()).toEqual([child1, child2]);
    });
});

describe("TUIElement.getAncestorPath", () => {
    it("returns single element for orphaned element", () => {
        const el = new TUIElement();
        expect(el.getAncestorPath()).toEqual([el]);
    });

    it("returns path from root to target", () => {
        const { root, parent, child } = buildTree();
        expect(child.getAncestorPath()).toEqual([root, parent, child]);
    });

    it("returns [root] for root element itself", () => {
        const { root } = buildTree();
        expect(root.getAncestorPath()).toEqual([root]);
    });
});

describe("TUIElement.getDepthFirstFocusableOrder", () => {
    it("returns empty when no elements are focusable", () => {
        const { root } = buildTree();
        expect(root.getDepthFirstFocusableOrder()).toEqual([]);
    });

    it("returns focusable elements in depth-first order", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        const a = new TUIElement();
        a.tabIndex = 0;
        const b = new TUIElement();
        b.tabIndex = 0;
        const c = new TUIElement();
        // c.tabIndex = -1 (default, not focusable)
        root.addChild(a);
        root.addChild(b);
        root.addChild(c);
        expect(root.getDepthFirstFocusableOrder()).toEqual([a, b]);
    });

    it("traverses nested containers depth-first", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        const containerA = new ContainerElement();
        root.addChild(containerA);
        const a1 = new TUIElement();
        a1.tabIndex = 0;
        containerA.addChild(a1);
        const a2 = new TUIElement();
        a2.tabIndex = 0;
        containerA.addChild(a2);

        const containerB = new ContainerElement();
        root.addChild(containerB);
        const b1 = new TUIElement();
        b1.tabIndex = 0;
        containerB.addChild(b1);

        expect(root.getDepthFirstFocusableOrder()).toEqual([a1, a2, b1]);
    });
});

describe("TUIElement.addEventListener (new event system)", () => {
    it("registers and fires bubble listener", () => {
        const el = new TUIElement();
        const handler = vi.fn();
        el.addEventListener("keydown", handler);

        const event = new TUIKeyboardEvent("keydown", { key: "a" });
        el.dispatchEvent(event);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(event);
    });

    it("registers and fires capture listener", () => {
        const el = new TUIElement();
        const handler = vi.fn();
        el.addEventListener("keydown", handler, { capture: true });

        const event = new TUIKeyboardEvent("keydown", { key: "a" });
        el.dispatchEvent(event);

        expect(handler).toHaveBeenCalledOnce();
    });

    it("removeEventListener removes specific listener", () => {
        const el = new TUIElement();
        const handler = vi.fn();
        el.addEventListener("keydown", handler);
        el.removeEventListener("keydown", handler);

        el.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));
        expect(handler).not.toHaveBeenCalled();
    });

    it("removeEventListener distinguishes capture vs bubble", () => {
        const el = new TUIElement();
        const handler = vi.fn();
        el.addEventListener("keydown", handler, { capture: true });
        // Removing bubble version should NOT remove capture version
        el.removeEventListener("keydown", handler, { capture: false });

        el.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));
        expect(handler).toHaveBeenCalledOnce();
    });
});

describe("TUIElement.dispatchEvent — propagation phases", () => {
    it("dispatches in capture → target → bubble order", () => {
        const { root, parent, child } = buildTree();
        const log: string[] = [];

        root.addEventListener("keydown", () => log.push("root-capture"), { capture: true });
        root.addEventListener("keydown", () => log.push("root-bubble"));
        parent.addEventListener("keydown", () => log.push("parent-capture"), { capture: true });
        parent.addEventListener("keydown", () => log.push("parent-bubble"));
        child.addEventListener("keydown", () => log.push("child-target"));

        child.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));

        expect(log).toEqual([
            "root-capture",
            "parent-capture",
            "child-target",
            "parent-bubble",
            "root-bubble",
        ]);
    });

    it("sets target and currentTarget correctly", () => {
        const { root, child } = buildTree();
        const targets: { target: TUIElement | null; currentTarget: TUIElement | null }[] = [];

        root.addEventListener("keydown", (e) => {
            targets.push({ target: e.target, currentTarget: e.currentTarget });
        }, { capture: true });
        child.addEventListener("keydown", (e) => {
            targets.push({ target: e.target, currentTarget: e.currentTarget });
        });

        child.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));

        expect(targets[0].target).toBe(child);
        expect(targets[0].currentTarget).toBe(root);
        expect(targets[1].target).toBe(child);
        expect(targets[1].currentTarget).toBe(child);
    });

    it("sets eventPhase correctly during dispatch", () => {
        const { root, parent, child } = buildTree();
        const phases: number[] = [];

        root.addEventListener("keydown", (e) => phases.push(e.eventPhase), { capture: true });
        parent.addEventListener("keydown", (e) => phases.push(e.eventPhase), { capture: true });
        child.addEventListener("keydown", (e) => phases.push(e.eventPhase));
        parent.addEventListener("keydown", (e) => phases.push(e.eventPhase));
        root.addEventListener("keydown", (e) => phases.push(e.eventPhase));

        child.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));

        expect(phases).toEqual([
            EventPhase.CAPTURING,
            EventPhase.CAPTURING,
            EventPhase.AT_TARGET,
            EventPhase.BUBBLING,
            EventPhase.BUBBLING,
        ]);
    });

    it("stopPropagation during capture prevents target and bubble", () => {
        const { root, parent, child } = buildTree();
        const log: string[] = [];

        root.addEventListener("keydown", (e) => {
            log.push("root-capture");
            e.stopPropagation();
        }, { capture: true });
        parent.addEventListener("keydown", () => log.push("parent-capture"), { capture: true });
        child.addEventListener("keydown", () => log.push("child-target"));
        root.addEventListener("keydown", () => log.push("root-bubble"));

        child.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));

        expect(log).toEqual(["root-capture"]);
    });

    it("stopPropagation during bubble prevents further bubbling", () => {
        const { root, parent, child } = buildTree();
        const log: string[] = [];

        child.addEventListener("keydown", () => log.push("child-target"));
        parent.addEventListener("keydown", (e) => {
            log.push("parent-bubble");
            e.stopPropagation();
        });
        root.addEventListener("keydown", () => log.push("root-bubble"));

        child.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));

        expect(log).toEqual(["child-target", "parent-bubble"]);
    });

    it("stopImmediatePropagation prevents other listeners on same element", () => {
        const el = new TUIElement();
        const log: string[] = [];

        el.addEventListener("keydown", (e) => {
            log.push("first");
            e.stopImmediatePropagation();
        });
        el.addEventListener("keydown", () => log.push("second"));

        el.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));

        expect(log).toEqual(["first"]);
    });

    it("non-bubbling event does not bubble", () => {
        const { root, child } = buildTree();
        const log: string[] = [];

        root.addEventListener("keydown", () => log.push("root-capture"), { capture: true });
        child.addEventListener("keydown", () => log.push("child-target"));
        root.addEventListener("keydown", () => log.push("root-bubble"));

        // Create a non-bubbling event
        const event = new TUIEventBase("keydown", false);
        child.dispatchEvent(event);

        expect(log).toEqual(["root-capture", "child-target"]);
    });

    it("returns true when preventDefault not called", () => {
        const el = new TUIElement();
        const result = el.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));
        expect(result).toBe(true);
    });

    it("returns false when preventDefault called", () => {
        const el = new TUIElement();
        el.addEventListener("keydown", (e) => e.preventDefault());
        const result = el.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));
        expect(result).toBe(false);
    });

    it("at target phase fires both capture and bubble listeners", () => {
        const el = new TUIElement();
        const log: string[] = [];

        el.addEventListener("keydown", () => log.push("capture"), { capture: true });
        el.addEventListener("keydown", () => log.push("bubble"));

        el.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));

        expect(log).toEqual(["capture", "bubble"]);
    });

    it("resets eventPhase to NONE after dispatch", () => {
        const el = new TUIElement();
        const event = new TUIKeyboardEvent("keydown", { key: "a" });
        el.dispatchEvent(event);
        expect(event.eventPhase).toBe(EventPhase.NONE);
        expect(event.currentTarget).toBeNull();
    });
});

describe("TUIElement focus convenience", () => {
    it("isFocused returns false when no focusManager", () => {
        const el = new TUIElement();
        expect(el.isFocused).toBe(false);
    });

    it("isFocused returns true when element is activeElement", () => {
        const root = new TUIElement();
        root.setAsRoot();
        const fm = new FocusManager(root);
        root.focusManager = fm;

        const child = new TUIElement();
        child.tabIndex = 0;
        child.setParent(root);
        fm.setFocus(child);

        expect(child.isFocused).toBe(true);
    });

    it("focus() sets this as active element", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        const fm = new FocusManager(root);
        root.focusManager = fm;

        const child = new TUIElement();
        child.tabIndex = 0;
        root.addChild(child);

        child.focus();
        expect(fm.activeElement).toBe(child);
    });

    it("blur() removes this from active element", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        const fm = new FocusManager(root);
        root.focusManager = fm;

        const child = new TUIElement();
        child.tabIndex = 0;
        root.addChild(child);

        child.focus();
        expect(fm.activeElement).toBe(child);

        child.blur();
        expect(fm.activeElement).toBeNull();
    });

    it("blur() is no-op if element is not focused", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        const fm = new FocusManager(root);
        root.focusManager = fm;

        const child1 = new TUIElement();
        child1.tabIndex = 0;
        root.addChild(child1);
        const child2 = new TUIElement();
        child2.tabIndex = 0;
        root.addChild(child2);

        child1.focus();
        child2.blur(); // child2 is not focused, should not affect anything
        expect(fm.activeElement).toBe(child1);
    });
});
