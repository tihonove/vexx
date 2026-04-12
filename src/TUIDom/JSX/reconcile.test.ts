import { describe, expect, it, vi } from "vitest";

import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { TUIElement } from "../TUIElement.ts";

import type { ComponentType } from "./jsx-runtime.ts";
import { jsx } from "./jsx-runtime.ts";
import { getElementType, reconcile } from "./reconcile.ts";

class FakeLabel extends TUIElement {
    public text = "";
}

const LabelComponent: ComponentType<{ text: string }> = (props: { text: string }): FakeLabel => {
    const el = new FakeLabel();
    el.text = props.text;
    return el;
};

LabelComponent.update = (el: TUIElement, props: { text: string }): void => {
    (el as FakeLabel).text = props.text;
};

function OtherComponent(_props: object): TUIElement {
    return new TUIElement();
}

describe("reconcile", () => {
    describe("with Blueprint node", () => {
        it("creates a new element when existing is null", () => {
            const bp = jsx(LabelComponent, { text: "hello" });
            const el = reconcile(null, bp);

            expect(el).toBeInstanceOf(FakeLabel);
            expect((el as FakeLabel).text).toBe("hello");
        });

        it("tracks component type on created element", () => {
            const bp = jsx(LabelComponent, { text: "hello" });
            const el = reconcile(null, bp);

            expect(getElementType(el)).toBe(LabelComponent);
        });

        it("reuses element when type matches", () => {
            const bp1 = jsx(LabelComponent, { text: "hello" });
            const el1 = reconcile(null, bp1);

            const bp2 = jsx(LabelComponent, { text: "world" });
            const el2 = reconcile(el1, bp2);

            expect(el2).toBe(el1);
            expect((el2 as FakeLabel).text).toBe("world");
        });

        it("creates new element when type does not match", () => {
            const bp1 = jsx(LabelComponent, { text: "hello" });
            const el1 = reconcile(null, bp1);

            const bp2 = jsx(OtherComponent, {});
            const el2 = reconcile(el1, bp2);

            expect(el2).not.toBe(el1);
            expect(el2).toBeInstanceOf(TUIElement);
            expect(getElementType(el2)).toBe(OtherComponent);
        });

        it("applies layout to element", () => {
            const layout = { width: "fill", height: 1 };
            const bp = jsx(LabelComponent, { text: "hello", layout });
            const el = reconcile(null, bp);

            expect(el.layoutStyle).toBe(layout);
        });

        it("calls ref callback", () => {
            const ref = vi.fn();
            const bp = jsx(LabelComponent, { text: "hello", ref });
            const el = reconcile(null, bp);

            expect(ref).toHaveBeenCalledWith(el);
        });

        it("calls ref on reuse too", () => {
            const bp1 = jsx(LabelComponent, { text: "hello" });
            const el1 = reconcile(null, bp1);

            const ref = vi.fn();
            const bp2 = jsx(LabelComponent, { text: "world", ref });
            reconcile(el1, bp2);

            expect(ref).toHaveBeenCalledWith(el1);
        });
    });

    describe("with TUIElement node (pass-through)", () => {
        it("returns the element as-is", () => {
            const existing = new TUIElement();
            const passedIn = new TUIElement();

            const result = reconcile(existing, passedIn);

            expect(result).toBe(passedIn);
        });

        it("ignores existing when node is a TUIElement", () => {
            const existing = new FakeLabel();
            const passedIn = new TUIElement();

            const result = reconcile(existing, passedIn);

            expect(result).toBe(passedIn);
        });
    });

    describe("event handler reconciliation", () => {
        function fireClick(el: TUIElement): void {
            const event = new TUIMouseEvent("click", {
                button: "left",
                screenX: 0,
                screenY: 0,
                localX: 0,
                localY: 0,
            });
            el.dispatchEvent(event);
        }

        it("attaches onClick handler on creation", () => {
            const handler = vi.fn();
            const bp = jsx(LabelComponent, { text: "hello", onClick: handler });
            const el = reconcile(null, bp);

            el.setAsRoot();
            fireClick(el);

            expect(handler).toHaveBeenCalledOnce();
        });

        it("replaces handler when function reference changes", () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            const bp1 = jsx(LabelComponent, { text: "hello", onClick: handler1 });
            const el = reconcile(null, bp1);
            el.setAsRoot();

            const bp2 = jsx(LabelComponent, { text: "hello", onClick: handler2 });
            reconcile(el, bp2);

            fireClick(el);

            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).toHaveBeenCalledOnce();
        });

        it("removes handler when prop is removed", () => {
            const handler = vi.fn();

            const bp1 = jsx(LabelComponent, { text: "hello", onClick: handler });
            const el = reconcile(null, bp1);
            el.setAsRoot();

            const bp2 = jsx(LabelComponent, { text: "hello" });
            reconcile(el, bp2);

            fireClick(el);

            expect(handler).not.toHaveBeenCalled();
        });

        it("does not re-add handler when same function reference", () => {
            const handler = vi.fn();

            const bp1 = jsx(LabelComponent, { text: "hello", onClick: handler });
            const el = reconcile(null, bp1);

            const bp2 = jsx(LabelComponent, { text: "world", onClick: handler });
            reconcile(el, bp2);

            el.setAsRoot();
            fireClick(el);

            // Should fire exactly once — if handler was added twice, it would fire twice
            expect(handler).toHaveBeenCalledOnce();
        });

        it("handles onKeyDown event prop", () => {
            const handler = vi.fn();
            const bp = jsx(LabelComponent, { text: "hello", onKeyDown: handler });
            const el = reconcile(null, bp);

            el.setAsRoot();
            const event = new TUIKeyboardEvent("keydown", { key: "a", bubbles: true });
            el.dispatchEvent(event);

            expect(handler).toHaveBeenCalledOnce();
        });
    });
});
