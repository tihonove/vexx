import { describe, expect, it } from "vitest";

import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { BoxConstraints, Offset, Point, Size } from "../Common/GeometryPromitives.ts";
import { MockTerminalBackend } from "../TerminalBackend/MockTerminalBackend.ts";
import { createKeyPressEvent } from "../TerminalBackend/KeyEvent.ts";
import { expectScreen, screen } from "../TestUtils/expectScreen.ts";

import { ScrollContainerElement } from "./ScrollContainerElement.ts";
import { TextBlockElement } from "./TextBlockElement.ts";
import { RenderContext } from "./TUIElement.ts";

function createScrollContainer(
    screenWidth: number,
    screenHeight: number,
    contentLineCount: number,
): {
    container: ScrollContainerElement;
    child: TextBlockElement;
    backend: MockTerminalBackend;
    termScreen: TerminalScreen;
} {
    const size = new Size(screenWidth, screenHeight);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    const child = new TextBlockElement(contentLineCount);
    const container = new ScrollContainerElement(child);
    return { container, child, backend, termScreen };
}

function renderContainer(
    container: ScrollContainerElement,
    termScreen: TerminalScreen,
    backend: MockTerminalBackend,
): MockTerminalBackend {
    container.performLayout(BoxConstraints.tight(termScreen.size));
    container.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

describe("ScrollContainerElement", () => {
    it("allocates child width as container width minus 1", () => {
        const { container, child } = createScrollContainer(12, 5, 20);
        container.performLayout(BoxConstraints.tight(new Size(12, 5)));
        expect(child.size.width).toBe(11);
        expect(child.size.height).toBe(5);
    });

    it("renders content with scrollbar in last column at top", () => {
        const { container, backend, termScreen } = createScrollContainer(12, 5, 50);
        renderContainer(container, termScreen, backend);

        expectScreen(
            backend,
            screen`
                Line 001   █
                Line 002   ░
                Line 003   ░
                Line 004   ░
                Line 005   ░
            `,
        );
    });

    it("renders scrollbar at bottom when fully scrolled", () => {
        const { container, child, backend, termScreen } = createScrollContainer(12, 5, 50);
        child.scrollTop = 45; // scroll to bottom (50 - 5 = 45)
        renderContainer(container, termScreen, backend);

        expectScreen(
            backend,
            screen`
                Line 046   ░
                Line 047   ░
                Line 048   ░
                Line 049   ░
                Line 050   █
            `,
        );
    });

    it("fills entire scrollbar when content fits viewport", () => {
        const { container, backend, termScreen } = createScrollContainer(12, 5, 5);
        renderContainer(container, termScreen, backend);

        expectScreen(
            backend,
            screen`
                Line 001   █
                Line 002   █
                Line 003   █
                Line 004   █
                Line 005   █
            `,
        );
    });

    it("fills entire scrollbar when content smaller than viewport", () => {
        const { container, backend, termScreen } = createScrollContainer(12, 5, 3);
        renderContainer(container, termScreen, backend);

        expectScreen(
            backend,
            screen`
                Line 001   █
                Line 002   █
                Line 003   █
                           █
                           █
            `,
        );
    });

    it("shows thumb in middle when scrolled halfway", () => {
        const { container, child, backend, termScreen } = createScrollContainer(12, 10, 100);
        child.scrollTop = 45; // scroll to ~50%
        renderContainer(container, termScreen, backend);

        // With halves: 10 track height = 20 halves
        // thumbSize = max(2, round(10/100 * 20)) = 2 halves = 1 cell
        // maxScroll = 90, scrollFraction = 45/90 = 0.5
        // thumbStart = round(0.5 * (20 - 2)) = 9 halves
        // thumb at halves 9-10, i.e. bottom of cell 4 + top of cell 5
        const lines = backend.screenToString().split("\n");
        const lastCol = lines.map((l) => l[11]);
        // Track cells before and after thumb
        expect(lastCol[0]).toBe("░");
        expect(lastCol[9]).toBe("░");
        // Thumb should be around row 4-5
        expect(lastCol[4]).toBe("▄"); // bottom half
        expect(lastCol[5]).toBe("▀"); // top half
    });

    it("renders half-block characters for non-aligned thumb positions", () => {
        // 5 track height, 50 content, viewport 5 → 10 halves
        // thumbSize = max(2, round(5/50 * 10)) = 2 halves
        // scrollTop = 5: scrollFraction = 5/45 ≈ 0.111
        // thumbStart = round(0.111 * (10 - 2)) = round(0.888) = 1 half
        // → row 0: top half out, bottom half in → ▄
        // → row 1: top half in (half 2), bottom half out (half 3 >= 3) → ▀
        const { container, child, backend, termScreen } = createScrollContainer(12, 5, 50);
        child.scrollTop = 5;
        renderContainer(container, termScreen, backend);

        const lines = backend.screenToString().split("\n");
        const lastCol = lines.map((l) => l[11]);
        // Should contain half-block elements
        expect(lastCol.some((c) => "▀▄".includes(c))).toBe(true);
    });

    it("forwards events to child", () => {
        const { container, child } = createScrollContainer(12, 5, 50);
        container.performLayout(BoxConstraints.tight(new Size(12, 5)));

        expect(child.scrollTop).toBe(0);

        container.emit(createKeyPressEvent("ArrowDown", "", { type: "keypress" }));

        expect(child.scrollTop).toBe(1);
    });

    it("sets child localPosition to (0, 0)", () => {
        const { container, child } = createScrollContainer(12, 5, 50);

        container.performLayout(BoxConstraints.tight(new Size(12, 5)));

        expect(child.localPosition).toEqual(new Offset(0, 0));
    });

    it("sets child globalPosition based on container globalPosition", () => {
        const { container, child } = createScrollContainer(12, 5, 50);

        // Set container global position to (10, 20)
        container.globalPosition = new Point(10, 20);
        container.performLayout(BoxConstraints.tight(new Size(12, 5)));

        // Child should be at (10, 20)
        expect(child.globalPosition).toEqual(new Point(10, 20));
    });

    it("child markDirty propagates to container", () => {
        const { container, child } = createScrollContainer(12, 5, 50);

        container.performLayout(BoxConstraints.tight(new Size(12, 5)));
        expect(container.isLayoutDirty).toBe(false);

        child.markDirty();

        expect(container.isLayoutDirty).toBe(true);
    });

    it("child inherits container as parent after construction", () => {
        const { container, child } = createScrollContainer(12, 5, 50);

        // Verify by checking that child's markDirty affects container
        container.performLayout(BoxConstraints.tight(new Size(12, 5)));
        child.markDirty();

        expect(container.isLayoutDirty).toBe(true);
    });

    it("allocates child width as container width minus 1 while updating coordinates", () => {
        const { container, child } = createScrollContainer(12, 5, 50);
        container.performLayout(BoxConstraints.tight(new Size(12, 5)));

        // Child should have width=11 (12-1 for scrollbar) and height=5
        expect(child.size.width).toBe(11);
        expect(child.size.height).toBe(5);
        // And should have proper coordinates
        expect(child.localPosition).toEqual(new Offset(0, 0));
    });
});
