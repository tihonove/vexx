import { describe, expect, it, vi } from "vitest";

import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { BoxConstraints, Point, Size } from "../Common/GeometryPromitives.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { MockTerminalBackend } from "../TerminalBackend/MockTerminalBackend.ts";
import { expectScreen, screen } from "../TestUtils/expectScreen.ts";

import type { MenuBarItem } from "./MenuBarElement.ts";
import { MenuBarElement } from "./MenuBarElement.ts";
import { RenderContext, TUIElement } from "./TUIElement.ts";

function renderMenuBar(
    items: MenuBarItem[],
    width = 30,
    height = 10,
): { backend: MockTerminalBackend; menuBar: MenuBarElement } {
    const menuBar = new MenuBarElement(items);
    const size = new Size(width, height);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    menuBar.globalPosition = new Point(0, 0);
    menuBar.performLayout(BoxConstraints.tight(size));
    menuBar.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return { backend, menuBar };
}

function simpleItems(): MenuBarItem[] {
    return [
        { label: "File", entries: [{ label: "New" }, { label: "Open" }, { label: "Save" }] },
        { label: "Edit", entries: [{ label: "Undo" }, { label: "Redo" }] },
        { label: "View", entries: [{ label: "Zoom In" }, { label: "Zoom Out" }] },
    ];
}

describe("MenuBarElement", () => {
    describe("rendering", () => {
        it("renders menu bar with item labels", () => {
            const { backend } = renderMenuBar(simpleItems());
            const firstLine = backend.getTextAt(new Point(0, 0), 30);
            expect(firstLine).toContain("File");
            expect(firstLine).toContain("Edit");
            expect(firstLine).toContain("View");
        });

        it("renders items as ' Label ' with padding", () => {
            const { backend } = renderMenuBar(simpleItems());
            const firstLine = backend.getTextAt(new Point(0, 0), 30);
            // Items are rendered as " File  Edit  View " with spaces around labels
            expect(firstLine).toContain(" File ");
            expect(firstLine).toContain(" Edit ");
            expect(firstLine).toContain(" View ");
        });

        it("fills full width with spaces on the bar row", () => {
            const { backend } = renderMenuBar(simpleItems(), 40, 5);
            const firstLine = backend.getTextAt(new Point(0, 0), 40);
            // The entire row should be filled (no nulls)
            expect(firstLine.length).toBe(40);
            // All characters should be non-null (spaces or label chars)
            for (const ch of firstLine) {
                expect(ch).not.toBe("\0");
            }
        });

        it("renders items at correct horizontal positions", () => {
            const { backend } = renderMenuBar(
                [
                    { label: "AB", entries: [] },
                    { label: "CD", entries: [] },
                ],
                20,
                3,
            );
            const firstLine = backend.getTextAt(new Point(0, 0), 20);
            // " AB " starts at 0, width=4; " CD " starts at 4
            expect(firstLine.slice(0, 4)).toBe(" AB ");
            expect(firstLine.slice(4, 8)).toBe(" CD ");
        });
    });

    describe("keyboard navigation", () => {
        it("opens menu by mnemonic (Alt + first letter)", () => {
            const { menuBar } = renderMenuBar(simpleItems());
            expect(menuBar.activeIndex).toBe(-1);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f", altKey: true }));
            expect(menuBar.activeIndex).toBe(0);
        });

        it("opens correct menu by mnemonic", () => {
            const { menuBar } = renderMenuBar(simpleItems());

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "e", altKey: true }));
            expect(menuBar.activeIndex).toBe(1);
        });

        it("uses explicit mnemonic property", () => {
            const items: MenuBarItem[] = [
                { label: "File", mnemonic: "f", entries: [] },
                { label: "Edit", mnemonic: "x", entries: [] },
            ];
            const { menuBar } = renderMenuBar(items);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "x", altKey: true }));
            expect(menuBar.activeIndex).toBe(1);
        });

        it("mnemonic match is case-insensitive", () => {
            const { menuBar } = renderMenuBar(simpleItems());

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "F", altKey: true }));
            expect(menuBar.activeIndex).toBe(0);
        });

        it("ArrowRight moves to next menu", () => {
            const { menuBar } = renderMenuBar(simpleItems());
            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f", altKey: true }));
            expect(menuBar.activeIndex).toBe(0);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowRight" }));
            expect(menuBar.activeIndex).toBe(1);
        });

        it("ArrowLeft moves to previous menu", () => {
            const { menuBar } = renderMenuBar(simpleItems());
            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "e", altKey: true }));
            expect(menuBar.activeIndex).toBe(1);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowLeft" }));
            expect(menuBar.activeIndex).toBe(0);
        });

        it("ArrowRight wraps from last to first", () => {
            const { menuBar } = renderMenuBar(simpleItems());
            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "v", altKey: true }));
            expect(menuBar.activeIndex).toBe(2);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowRight" }));
            expect(menuBar.activeIndex).toBe(0);
        });

        it("ArrowLeft wraps from first to last", () => {
            const { menuBar } = renderMenuBar(simpleItems());
            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f", altKey: true }));
            expect(menuBar.activeIndex).toBe(0);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowLeft" }));
            expect(menuBar.activeIndex).toBe(2);
        });

        it("Escape closes menu", () => {
            const { menuBar } = renderMenuBar(simpleItems());
            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f", altKey: true }));
            expect(menuBar.activeIndex).toBe(0);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Escape" }));
            expect(menuBar.activeIndex).toBe(-1);
        });

        it("ignores ArrowLeft/Right when no menu is open", () => {
            const { menuBar } = renderMenuBar(simpleItems());
            expect(menuBar.activeIndex).toBe(-1);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowRight" }));
            expect(menuBar.activeIndex).toBe(-1);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowLeft" }));
            expect(menuBar.activeIndex).toBe(-1);
        });

        it("does not match mnemonic without Alt", () => {
            const { menuBar } = renderMenuBar(simpleItems());
            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f" }));
            expect(menuBar.activeIndex).toBe(-1);
        });

        it("does not match mnemonic with Ctrl+Alt", () => {
            const { menuBar } = renderMenuBar(simpleItems());
            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f", altKey: true, ctrlKey: true }));
            expect(menuBar.activeIndex).toBe(-1);
        });
    });

    describe("dropdown interaction", () => {
        it("renders dropdown menu when active", () => {
            const items: MenuBarItem[] = [{ label: "File", entries: [{ label: "New" }, { label: "Open" }] }];
            const menuBar = new MenuBarElement(items);
            const size = new Size(20, 8);
            const backend = new MockTerminalBackend(size);
            const termScreen = new TerminalScreen(size);

            menuBar.globalPosition = new Point(0, 0);
            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f", altKey: true }));

            menuBar.performLayout(BoxConstraints.tight(size));
            menuBar.render(new RenderContext(termScreen));
            termScreen.flush(backend);

            expectScreen(
                backend,
                screen`
                     File              
                    ┌──────┐           
                    │ New  │           
                    │ Open │           
                    └──────┘           
                `,
            );
        });

        it("navigates dropdown with ArrowDown", () => {
            const items: MenuBarItem[] = [
                { label: "File", entries: [{ label: "New" }, { label: "Open" }, { label: "Save" }] },
            ];
            const menuBar = new MenuBarElement(items);
            menuBar.globalPosition = new Point(0, 0);
            menuBar.performLayout(BoxConstraints.tight(new Size(20, 10)));

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f", altKey: true }));
            // ArrowDown moves selection in the popup
            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "ArrowDown" }));
            // Selection should have moved (popup starts at index 0, ArrowDown goes to 1)
            // We can't inspect the popup directly but the event doesn't crash
            expect(menuBar.activeIndex).toBe(0); // menu bar stays on File
        });

        it("calls onSelect and closes menu on Enter", () => {
            const onNew = vi.fn();
            const items: MenuBarItem[] = [
                { label: "File", entries: [{ label: "New", onSelect: onNew }, { label: "Open" }] },
            ];
            const menuBar = new MenuBarElement(items);
            menuBar.globalPosition = new Point(0, 0);
            menuBar.performLayout(BoxConstraints.tight(new Size(20, 10)));

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f", altKey: true }));
            expect(menuBar.activeIndex).toBe(0);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Enter" }));

            expect(onNew).toHaveBeenCalledOnce();
            expect(menuBar.activeIndex).toBe(-1); // menu closed after selection
        });

        it("Escape in dropdown closes the menu bar item", () => {
            const items: MenuBarItem[] = [{ label: "File", entries: [{ label: "New" }] }];
            const menuBar = new MenuBarElement(items);
            menuBar.globalPosition = new Point(0, 0);
            menuBar.performLayout(BoxConstraints.tight(new Size(20, 10)));

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f", altKey: true }));
            expect(menuBar.activeIndex).toBe(0);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "Escape" }));
            expect(menuBar.activeIndex).toBe(-1);
        });

        it("switching menu with mnemonic while another is open", () => {
            const { menuBar } = renderMenuBar(simpleItems());

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f", altKey: true }));
            expect(menuBar.activeIndex).toBe(0);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "e", altKey: true }));
            expect(menuBar.activeIndex).toBe(1);
        });
    });

    describe("event routing", () => {
        it("routes events to content when no menu is open", () => {
            const items: MenuBarItem[] = [{ label: "File", entries: [{ label: "New" }] }];
            const menuBar = new MenuBarElement(items);
            const content = new TUIElement();
            const keys: string[] = [];
            content.addEventListener("keydown", (e) => keys.push(e.key));
            menuBar.setContent(content);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "a" }));
            expect(keys).toEqual(["a"]);
        });

        it("does not route non-mnemonic events to content when menu is open", () => {
            const items: MenuBarItem[] = [{ label: "File", entries: [{ label: "New" }] }];
            const menuBar = new MenuBarElement(items);
            const content = new TUIElement();
            const keys: string[] = [];
            content.addEventListener("keydown", (e) => keys.push(e.key));
            menuBar.setContent(content);

            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "f", altKey: true }));
            expect(menuBar.activeIndex).toBe(0);

            keys.length = 0;
            menuBar.dispatchEvent(new TUIKeyboardEvent("keydown", { key: "x" }));
            // "x" should go to the popup menu, not content
            expect(keys).toEqual([]);
        });
    });

    describe("layout", () => {
        it("positions content below the menu bar row", () => {
            const items: MenuBarItem[] = [{ label: "File", entries: [] }];
            const menuBar = new MenuBarElement(items);
            const content = new TUIElement();
            menuBar.setContent(content);

            menuBar.globalPosition = new Point(0, 0);
            menuBar.performLayout(BoxConstraints.tight(new Size(40, 20)));

            expect(content.localPosition.dy).toBe(1);
            expect(content.globalPosition.y).toBe(1);
        });

        it("gives content full width and height minus 1", () => {
            const items: MenuBarItem[] = [{ label: "File", entries: [] }];
            const menuBar = new MenuBarElement(items);
            const content = new TUIElement();
            menuBar.setContent(content);

            menuBar.globalPosition = new Point(0, 0);
            menuBar.performLayout(BoxConstraints.tight(new Size(40, 20)));

            expect(content.size.width).toBe(40);
            expect(content.size.height).toBe(19);
        });
    });
});
