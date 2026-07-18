import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { Point, Size } from "../../Common/GeometryPromitives.ts";
import { TuiApplication } from "../TuiApplication.ts";
import { TUIElement } from "../TUIElement.ts";

import { BodyElement } from "./BodyElement.ts";
import type { MenuBarItem } from "./MenuBarElement.ts";
import { MenuBarElement } from "./MenuBarElement.ts";
import { unthemedMenuStyles } from "./PopupMenuItemElement.tsx";
import { VStackElement } from "./VStackElement.ts";

class FocusableChild extends TUIElement {
    public constructor() {
        super();
        this.tabIndex = 0;
    }

    public render(): void {
        // noop
    }
}

function setup(
    items: MenuBarItem[],
    width = 30,
    height = 15,
): {
    backend: MockTerminalBackend;
    app: TuiApplication;
    menuBar: MenuBarElement;
} {
    const backend = new MockTerminalBackend(new Size(width, height));
    const app = new TuiApplication(backend);

    const body = new BodyElement();
    const menuBar = new MenuBarElement(items);
    const stack = new VStackElement();
    const child = new FocusableChild();
    stack.addChild(child, { width: "fill", height: 3 });

    body.setMenuBar(menuBar);
    body.setContent(stack);
    app.root = body;
    app.run();

    return { backend, app, menuBar };
}

function simpleItems(): MenuBarItem[] {
    return [
        { label: "File", entries: [{ label: "New" }, { label: "Open" }, { label: "Save" }] },
        { label: "Edit", entries: [{ label: "Undo" }, { label: "Redo" }] },
    ];
}

describe("PopupMenuElement selection colors", () => {
    it("first item is highlighted when popup opens", () => {
        const { backend } = setup(simpleItems());
        backend.sendKey("Tab");
        backend.sendKey("ArrowDown");
        // Popup border at x=2 (top-left ╭), first item "New" at y=2, content column at x=3.
        expect(backend.getBgAt(new Point(3, 2))).toBe(unthemedMenuStyles.highlightBg);
    });

    it("first item has highlight foreground when popup opens", () => {
        const { backend } = setup(simpleItems());
        backend.sendKey("Tab");
        backend.sendKey("ArrowDown");
        expect(backend.getFgAt(new Point(3, 2))).toBe(unthemedMenuStyles.highlightFg);
    });

    it("ArrowDown moves highlight to second item", () => {
        const { backend } = setup(simpleItems());
        backend.sendKey("Tab");
        backend.sendKey("ArrowDown");
        backend.sendKey("ArrowDown");
        expect(backend.getBgAt(new Point(3, 2))).not.toBe(unthemedMenuStyles.highlightBg);
        expect(backend.getBgAt(new Point(3, 3))).toBe(unthemedMenuStyles.highlightBg);
    });
});
