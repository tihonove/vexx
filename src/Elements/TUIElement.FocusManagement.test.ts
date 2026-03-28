import { describe, expect, it } from "vitest";

import { FocusManager } from "../Events/FocusManager.ts";

import { TUIElement } from "./TUIElement.ts";

class ContainerElement extends TUIElement {
    private _children: TUIElement[] = [];

    public addChild(child: TUIElement): void {
        child.setParent(this);
        this._children.push(child);
    }

    public override getChildren(): readonly TUIElement[] {
        return this._children;
    }
}

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
