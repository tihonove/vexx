import { describe, expect, it } from "vitest";

import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { Size } from "../Common/GeometryPromitives.ts";
import { MockTerminalBackend } from "../TerminalBackend/MockTerminalBackend.ts";
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
    container.size = size;
    return { container, child, backend, termScreen };
}

function renderContainer(
    container: ScrollContainerElement,
    termScreen: TerminalScreen,
    backend: MockTerminalBackend,
): MockTerminalBackend {
    container.performLayout();
    container.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

describe("ScrollContainerElement", () => {
    it("allocates child width as container width minus 1", () => {
        const { container, child } = createScrollContainer(12, 5, 20);
        container.performLayout();
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

        // With 10 track height, 100 content, viewport 10:
        // thumbSize = max(8, round(10/100 * 80)) = 8 eighths = 1 cell
        // maxScroll = 90, scrollFraction = 45/90 = 0.5
        // thumbStart = round(0.5 * (80 - 8)) = 36 eighths → cell 4 starts at 32, so at 4/8 into cell 4
        const lines = backend.screenToString().split("\n");
        // Thumb should be around row 4-5
        expect(lines[0]).toContain("░");
        expect(lines[9]).toContain("░");
    });

    it("renders sub-character blocks for non-aligned thumb positions", () => {
        // 5 track height, 50 content, viewport 5
        // thumbSize = max(8, round(5/50 * 40)) = 8 eighths
        // scrollTop = 5: scrollFraction = 5/45 ≈ 0.111
        // thumbStart = round(0.111 * (40 - 8)) = round(3.55) = 4 eighths
        // → row 0: thumb starts at 4 within cell (bottom 4/8 = ▄)
        // → row 1: thumb ends at 12, cell 1 = 8..16, 12-8=4 → ▄
        const { container, child, backend, termScreen } = createScrollContainer(12, 5, 50);
        child.scrollTop = 5;
        renderContainer(container, termScreen, backend);

        const lines = backend.screenToString().split("\n");
        const lastCol = lines.map((l) => l[11]);
        // Should contain partial block elements
        expect(lastCol.some((c) => "▁▂▃▄▅▆▇".includes(c))).toBe(true);
    });

    it("forwards events to child", () => {
        const { container, child } = createScrollContainer(12, 5, 50);
        container.performLayout();

        expect(child.scrollTop).toBe(0);

        container.emit({
            type: "keypress",
            key: "ArrowDown",
            code: "ArrowDown",
            shiftKey: false,
            ctrlKey: false,
            altKey: false,
            metaKey: false,
        });

        expect(child.scrollTop).toBe(1);
    });
});
