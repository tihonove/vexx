import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Offset, Point, Rect, Size } from "../../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../../Rendering/TerminalScreen.ts";
import { FakeTerminalSurface } from "../../../TestUtils/FakeTerminalSurface.ts";
import { TestApp } from "../../../TestUtils/TestApp.ts";
import { RenderContext } from "../../TUIElement.ts";

import { TerminalPaneElement, TERMINAL_LIST_WIDTH } from "./TerminalPaneElement.ts";
import { TerminalViewElement } from "./TerminalViewElement.ts";

function makeWidget(): TerminalViewElement {
    return new TerminalViewElement(new FakeTerminalSurface());
}

function layout(pane: TerminalPaneElement, size: Size): void {
    pane.globalPosition = new Point(0, 0);
    pane.performLayout(BoxConstraints.tight(size));
}

function render(pane: TerminalPaneElement, size: Size): MockTerminalBackend {
    const backend = new MockTerminalBackend(size);
    const screen = new TerminalScreen(size);
    pane.render(new RenderContext(screen, new Offset(0, 0), new Rect(new Point(0, 0), size)));
    screen.flush(backend);
    return backend;
}

describe("TerminalPaneElement", () => {
    it("gives the terminal the full width when the list is hidden", () => {
        const pane = new TerminalPaneElement();
        const widget = makeWidget();
        pane.setActiveWidget(widget);
        layout(pane, new Size(40, 10));

        expect(pane.isListVisible()).toBe(false);
        expect(pane.getChildren()).toEqual([widget]);
        expect(widget.layoutSize.width).toBe(40);
        widget.dispose();
    });

    it("splits terminal + fixed-width list when the list is visible", () => {
        const pane = new TerminalPaneElement();
        const widget = makeWidget();
        pane.setActiveWidget(widget);
        pane.setListVisible(true);
        layout(pane, new Size(40, 10));

        // list = 24, separator = 1, terminal = 40 - 24 - 1 = 15.
        expect(widget.layoutSize.width).toBe(40 - TERMINAL_LIST_WIDTH - 1);
        expect(pane.list.layoutSize.width).toBe(TERMINAL_LIST_WIDTH);
        expect(pane.list.localPosition.dx).toBe(16);
        expect(pane.getChildren()).toEqual([widget, pane.list]);
        widget.dispose();
    });

    it("draws a vertical separator between terminal and list", () => {
        const pane = new TerminalPaneElement();
        pane.setActiveWidget(makeWidget());
        pane.setListVisible(true);
        layout(pane, new Size(40, 6));
        const backend = render(pane, new Size(40, 6));
        // Separator sits at the terminal width column (15) on every row.
        expect(backend.getTextAt(new Point(15, 0), 1)).toBe("│");
        expect(backend.getTextAt(new Point(15, 5), 1)).toBe("│");
    });

    it("swaps the active widget, detaching the previous one", () => {
        const pane = new TerminalPaneElement();
        const first = makeWidget();
        const second = makeWidget();
        pane.setActiveWidget(first);
        pane.setActiveWidget(second);

        expect(pane.getChildren()).toEqual([second]);
        expect(first.getParent()).toBeNull();
        expect(second.getParent()).toBe(pane);
        first.dispose();
        second.dispose();
    });

    it("no-ops when the active widget or visibility is unchanged", () => {
        const pane = new TerminalPaneElement();
        const widget = makeWidget();
        pane.setActiveWidget(widget);
        pane.setActiveWidget(widget); // same → early return
        pane.setListVisible(false); // already hidden → early return
        expect(pane.getChildren()).toEqual([widget]);
        widget.dispose();
    });

    it("clamps the list width on a very narrow pane", () => {
        const pane = new TerminalPaneElement();
        const widget = makeWidget();
        pane.setActiveWidget(widget);
        pane.setListVisible(true);
        layout(pane, new Size(10, 4));
        // list = min(24, 10 - 1) = 9, separator = 1, terminal = 0.
        expect(pane.list.layoutSize.width).toBe(9);
        expect(widget.layoutSize.width).toBe(0);
        widget.dispose();
    });

    it("lays out and renders with no active widget (only the list)", () => {
        const pane = new TerminalPaneElement();
        pane.setListVisible(true);
        layout(pane, new Size(40, 6));
        const backend = render(pane, new Size(40, 6));
        expect(pane.getChildren()).toEqual([pane.list]);
        expect(backend.getTextAt(new Point(15, 0), 1)).toBe("│"); // separator still drawn
    });

    it("delegates focus to the active widget and is safe with none", () => {
        const pane = new TerminalPaneElement();
        expect(() => pane.focus()).not.toThrow(); // no active widget yet

        const widget = makeWidget();
        pane.setActiveWidget(widget);
        const app = TestApp.createWithContent(pane, new Size(40, 10));
        app.render();
        pane.focus();
        app.render();
        expect(widget.isFocused).toBe(true);
        widget.dispose();
    });
});
