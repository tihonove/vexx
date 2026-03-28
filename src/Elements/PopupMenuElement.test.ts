import { describe, expect, it } from "vitest";

import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { BoxConstraints, Point, Size } from "../Common/GeometryPromitives.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { MockTerminalBackend } from "../TerminalBackend/MockTerminalBackend.ts";
import { expectScreen, screen } from "../TestUtils/expectScreen.ts";

import type { MenuEntry } from "./PopupMenuElement.ts";
import { PopupMenuElement } from "./PopupMenuElement.ts";
import { RenderContext } from "./TUIElement.ts";

function renderMenu(entries: MenuEntry[], width?: number, height?: number): MockTerminalBackend {
    const menu = new PopupMenuElement(entries);
    const intrinsic = menu.getIntrinsicSize();
    const size = new Size(width ?? intrinsic.width, height ?? intrinsic.height);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    menu.performLayout(BoxConstraints.tight(size));
    menu.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

describe("PopupMenuElement", () => {
    describe("intrinsic size", () => {
        it("computes size for simple items", () => {
            const menu = new PopupMenuElement([{ label: "Cut" }, { label: "Copy" }, { label: "Paste" }]);
            const size = menu.getIntrinsicSize();
            // border(1) + pad(1) + "Paste"(5) + pad(1) + border(1) = 9
            expect(size.width).toBe(9);
            // border(1) + 3 items + border(1) = 5
            expect(size.height).toBe(5);
        });

        it("accounts for shortcuts in width", () => {
            const menu = new PopupMenuElement([
                { label: "Cut", shortcut: "Ctrl+X" },
                { label: "Copy", shortcut: "Ctrl+C" },
            ]);
            const size = menu.getIntrinsicSize();
            // border(1) + pad(1) + "Copy"(4) + gap(2) + "Ctrl+X"(6) + pad(1) + border(1) = 16
            expect(size.width).toBe(16);
        });

        it("accounts for icons in width", () => {
            const menu = new PopupMenuElement([{ label: "Cut", icon: "✂" }, { label: "Paste" }]);
            const size = menu.getIntrinsicSize();
            // When icon present, icon replaces left pad: border(1) + icon(2) + "Paste"(5) + pad(1) + border(1) = 10
            expect(size.width).toBe(10);
        });

        it("accounts for separators in height", () => {
            const menu = new PopupMenuElement([{ label: "Cut" }, { type: "separator" }, { label: "Paste" }]);
            const size = menu.getIntrinsicSize();
            // border(1) + 3 entries + border(1) = 5
            expect(size.height).toBe(5);
        });
    });

    describe("rendering", () => {
        it("renders simple menu with border", () => {
            const backend = renderMenu([{ label: "Cut" }, { label: "Copy" }, { label: "Paste" }]);
            expectScreen(
                backend,
                screen`
                    ┌───────┐
                    │ Cut   │
                    │ Copy  │
                    │ Paste │
                    └───────┘
                `,
            );
        });

        it("renders menu with separator", () => {
            const backend = renderMenu([{ label: "Cut" }, { type: "separator" }, { label: "Paste" }]);
            expectScreen(
                backend,
                screen`
                    ┌───────┐
                    │ Cut   │
                    ├───────┤
                    │ Paste │
                    └───────┘
                `,
            );
        });

        it("renders menu with shortcuts", () => {
            const backend = renderMenu([
                { label: "Cut", shortcut: "Ctrl+X" },
                { label: "Copy", shortcut: "Ctrl+C" },
            ]);
            expectScreen(
                backend,
                screen`
                    ┌──────────────┐
                    │ Cut    Ctrl+X│
                    │ Copy   Ctrl+C│
                    └──────────────┘
                `,
            );
        });

        it("renders menu with icons", () => {
            const scissors = "\uf0c4";
            const copy = "\uf0c5";
            const backend = renderMenu([
                { label: "Cut", icon: scissors },
                { label: "Copy", icon: copy },
            ]);
            expectScreen(
                backend,
                screen`
                    ┌───────┐
                    │${scissors} Cut  │
                    │${copy} Copy │
                    └───────┘
                `,
            );
        });
    });

    describe("keyboard navigation", () => {
        it("selects first item by default", () => {
            const menu = new PopupMenuElement([{ label: "Cut" }, { label: "Copy" }]);
            expect(menu.selectedIndex).toBe(0);
        });

        it("moves selection down on ArrowDown", () => {
            const menu = new PopupMenuElement([{ label: "Cut" }, { label: "Copy" }, { label: "Paste" }]);
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowDown" }));
            expect(menu.selectedIndex).toBe(1);
        });

        it("moves selection up on ArrowUp", () => {
            const menu = new PopupMenuElement([{ label: "Cut" }, { label: "Copy" }, { label: "Paste" }]);
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowDown" }));
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowDown" }));
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowUp" }));
            expect(menu.selectedIndex).toBe(1);
        });

        it("wraps selection from bottom to top", () => {
            const menu = new PopupMenuElement([{ label: "Cut" }, { label: "Copy" }]);
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowDown" }));
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowDown" })); // wraps
            expect(menu.selectedIndex).toBe(0);
        });

        it("wraps selection from top to bottom", () => {
            const menu = new PopupMenuElement([{ label: "Cut" }, { label: "Copy" }]);
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowUp" })); // wraps
            expect(menu.selectedIndex).toBe(1);
        });

        it("skips separators during navigation", () => {
            const menu = new PopupMenuElement([{ label: "Cut" }, { type: "separator" }, { label: "Paste" }]);
            expect(menu.selectedIndex).toBe(0);
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowDown" }));
            expect(menu.selectedIndex).toBe(2); // skipped separator at index 1
        });

        it("calls onSelect on Enter", () => {
            let selected = false;
            const menu = new PopupMenuElement([
                {
                    label: "Cut",
                    onSelect: () => {
                        selected = true;
                    },
                },
            ]);
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Enter" }));
            expect(selected).toBe(true);
        });

        it("calls onClose on Escape", () => {
            let closed = false;
            const menu = new PopupMenuElement([{ label: "Cut" }]);
            menu.onClose = () => {
                closed = true;
            };
            menu.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Escape" }));
            expect(closed).toBe(true);
        });
    });
});
