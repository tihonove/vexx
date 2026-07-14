import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../../../tui/backend/mockTerminalBackend.ts";
import { Point, Size } from "../../../common/geometry.ts";
import { TuiApplication } from "../../tuiApplication.ts";
import { TUIElement } from "../../tuiElement.ts";

import { BodyElement } from "../../bodyElement.ts";
import type { MenuBarItem } from "./menuBarElement.ts";
import { MenuBarElement } from "./menuBarElement.ts";
import { DEFAULT_MENU_COLORS } from "./popupMenuItemElement.tsx";
import { VStackElement } from "../layout/vStackElement.ts";

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
        expect(backend.getBgAt(new Point(3, 2))).toBe(DEFAULT_MENU_COLORS.highlightBg);
    });

    it("first item has highlight foreground when popup opens", () => {
        const { backend } = setup(simpleItems());
        backend.sendKey("Tab");
        backend.sendKey("ArrowDown");
        expect(backend.getFgAt(new Point(3, 2))).toBe(DEFAULT_MENU_COLORS.highlightFg);
    });

    it("ArrowDown moves highlight to second item", () => {
        const { backend } = setup(simpleItems());
        backend.sendKey("Tab");
        backend.sendKey("ArrowDown");
        backend.sendKey("ArrowDown");
        expect(backend.getBgAt(new Point(3, 2))).not.toBe(DEFAULT_MENU_COLORS.highlightBg);
        expect(backend.getBgAt(new Point(3, 3))).toBe(DEFAULT_MENU_COLORS.highlightBg);
    });
});
