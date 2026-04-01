import { describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TUIElement } from "../TUIDom/TUIElement.ts";
import { BoxElement } from "../TUIDom/Widgets/BoxElement.ts";

import { TestApp } from "./TestApp.ts";

class ContainerElement extends TUIElement {
    private children: TUIElement[] = [];

    public addChild(child: TUIElement): void {
        child.setParent(this);
        this.children.push(child);
    }

    public override getChildren(): readonly TUIElement[] {
        return this.children;
    }
}

describe("TestApp", () => {
    it("creates app with root element", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        const testApp = TestApp.create(root, new Size(20, 5));

        expect(testApp.root).toBe(root);
    });

    it("sendKey delivers keyboard event to focused element", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        const child = new TUIElement();
        child.tabIndex = 0;
        root.addChild(child);

        const testApp = TestApp.create(root, new Size(20, 5));
        child.focus();

        const handler = vi.fn();
        child.addEventListener("keydown", handler);
        testApp.sendKey("a");

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].key).toBe("a");
    });

    it("querySelector delegates to root", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        const box = new BoxElement();
        box.id = "main-box";
        root.addChild(box);

        const testApp = TestApp.create(root, new Size(20, 5));

        expect(testApp.querySelector("#main-box")).toBe(box);
        expect(testApp.querySelector("BoxElement")).toBe(box);
    });

    it("querySelectorAll delegates to root", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        const a = new TUIElement();
        a.role = "item";
        const b = new TUIElement();
        b.role = "item";
        root.addChild(a);
        root.addChild(b);

        const testApp = TestApp.create(root, new Size(20, 5));

        expect(testApp.querySelectorAll("@item")).toEqual([a, b]);
    });

    it("focusedElement returns currently focused element", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        const a = new TUIElement();
        a.tabIndex = 0;
        a.role = "first";
        const b = new TUIElement();
        b.tabIndex = 0;
        b.role = "second";
        root.addChild(a);
        root.addChild(b);

        const testApp = TestApp.create(root, new Size(20, 5));

        expect(testApp.focusedElement).toBeNull();

        a.focus();
        expect(testApp.focusedElement).toBe(a);

        b.focus();
        expect(testApp.focusedElement).toBe(b);
    });

    it("Tab cycles focus between focusable elements", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        const a = new TUIElement();
        a.tabIndex = 0;
        a.id = "first";
        const b = new TUIElement();
        b.tabIndex = 0;
        b.id = "second";
        root.addChild(a);
        root.addChild(b);

        const testApp = TestApp.create(root, new Size(20, 5));
        a.focus();

        expect(testApp.focusedElement).toBe(a);
        testApp.sendKey("Tab");
        expect(testApp.focusedElement).toBe(b);
        testApp.sendKey("Tab");
        expect(testApp.focusedElement).toBe(a);
    });
});
