import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { Point, Size } from "../../Common/GeometryPromitives.ts";
import { TuiApplication } from "../TuiApplication.ts";
import { TUIElement } from "../TUIElement.ts";

import { BodyElement } from "./BodyElement.ts";
import type { MenuBarItem } from "./MenuBarElement.ts";
import { MenuBarElement } from "./MenuBarElement.ts";
import { ACTIVE_MENU_BG, ACTIVE_MENU_FG, MENU_BAR_BG, MENU_BAR_FG } from "./MenuBarItemElement.tsx";
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

function simpleItems(): MenuBarItem[] {
    return [
        { label: "File", entries: [{ label: "New" }, { label: "Open" }, { label: "Save" }] },
        { label: "Edit", entries: [{ label: "Undo" }, { label: "Redo" }] },
        { label: "View", entries: [{ label: "Zoom In" }, { label: "Zoom Out" }] },
    ];
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

describe("MenuBarElement focus colors", () => {
    // " File " occupies positions x=1..6 on y=0 (x=0 is the 1-char spacer)
    // " Edit " occupies positions x=7..12 on y=0
    // " View " occupies positions x=13..18 on y=0

    it("unfocused menu items have bar background color", () => {
        const { backend } = setup(simpleItems());

        // All items should have MENU_BAR_BG
        for (let x = 0; x < 18; x++) {
            expect(backend.getBgAt(new Point(x, 0))).toBe(MENU_BAR_BG);
        }
    });

    it("unfocused menu items have bar foreground color", () => {
        const { backend } = setup(simpleItems());

        for (let x = 0; x < 18; x++) {
            expect(backend.getFgAt(new Point(x, 0))).toBe(MENU_BAR_FG);
        }
    });

    it("focused menu item has active background color", () => {
        const { backend } = setup(simpleItems());

        backend.sendKey("Tab"); // focus menuBar → activeIndex=0 ("File")

        // " File " positions should have ACTIVE_MENU_BG (starts at x=2 due to spacer)
        for (let x = 2; x < 8; x++) {
            expect(backend.getBgAt(new Point(x, 0))).toBe(ACTIVE_MENU_BG);
        }
    });

    it("focused menu item has active foreground color", () => {
        const { backend } = setup(simpleItems());

        backend.sendKey("Tab");

        for (let x = 2; x < 8; x++) {
            expect(backend.getFgAt(new Point(x, 0))).toBe(ACTIVE_MENU_FG);
        }
    });

    it("non-active items keep bar colors when menuBar is focused", () => {
        const { backend } = setup(simpleItems());

        backend.sendKey("Tab"); // focus → "File" active

        // " Edit " at x=8..13 should keep bar colors
        for (let x = 8; x < 14; x++) {
            expect(backend.getBgAt(new Point(x, 0))).toBe(MENU_BAR_BG);
        }
    });

    it("ArrowRight moves active highlight to next item", () => {
        const { backend } = setup(simpleItems());

        backend.sendKey("Tab"); // focus → "File"
        backend.sendKey("ArrowRight"); // → "Edit"

        // " File " should revert to bar colors
        for (let x = 2; x < 8; x++) {
            expect(backend.getBgAt(new Point(x, 0))).toBe(MENU_BAR_BG);
        }

        // " Edit " should have active colors
        for (let x = 8; x < 14; x++) {
            expect(backend.getBgAt(new Point(x, 0))).toBe(ACTIVE_MENU_BG);
        }
    });

    it("blur resets all items to bar colors", () => {
        const { backend } = setup(simpleItems());

        backend.sendKey("Tab"); // focus menuBar
        backend.sendKey("Tab"); // blur menuBar (focus child)

        // All items should revert to MENU_BAR_BG
        for (let x = 0; x < 18; x++) {
            expect(backend.getBgAt(new Point(x, 0))).toBe(MENU_BAR_BG);
        }
    });
});
