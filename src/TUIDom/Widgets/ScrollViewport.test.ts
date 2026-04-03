import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { expectScreen, screen } from "../../TestUtils/expectScreen.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { IScrollable } from "./IScrollable.ts";
import { ScrollViewport } from "./ScrollViewport.ts";

/**
 * A simple widget that always draws ALL its lines in local coordinates,
 * without any scroll awareness. Used to test ScrollViewport clipping.
 */
class FullContentWidget extends TUIElement implements IScrollable {
    public contentHeight: number;
    public contentWidth: number;
    public scrollTop = 0;
    public scrollLeft = 0;
    private lines: string[];

    public constructor(lineCount: number) {
        super();
        this.contentHeight = lineCount;
        this.lines = [];
        for (let i = 0; i < lineCount; i++) {
            this.lines.push(`Line ${String(i + 1).padStart(3, "0")}`);
        }
        this.contentWidth = this.lines.reduce((max, l) => Math.max(max, l.length), 0);
    }

    public override render(context: RenderContext): void {
        for (let y = 0; y < this.contentHeight; y++) {
            const line = this.lines[y];
            for (let x = 0; x < this.contentWidth; x++) {
                const char = x < line.length ? line[x] : " ";
                context.setCell(x, y, { char });
            }
        }
    }
}

function createViewport(
    screenWidth: number,
    screenHeight: number,
    contentLineCount: number,
): {
    viewport: ScrollViewport;
    child: FullContentWidget;
    backend: MockTerminalBackend;
    termScreen: TerminalScreen;
} {
    const size = new Size(screenWidth, screenHeight);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    const child = new FullContentWidget(contentLineCount);
    const viewport = new ScrollViewport(child);
    return { viewport, child, backend, termScreen };
}

function renderViewport(
    viewport: ScrollViewport,
    termScreen: TerminalScreen,
    backend: MockTerminalBackend,
): MockTerminalBackend {
    viewport.globalPosition = new Point(0, 0);
    viewport.performLayout(BoxConstraints.tight(termScreen.size));
    const clipRect = new Rect(new Point(0, 0), termScreen.size);
    viewport.render(new RenderContext(termScreen, new Offset(0, 0), clipRect));
    termScreen.flush(backend);
    return backend;
}

describe("ScrollViewport", () => {
    it("shows first lines when scrollTop is 0", () => {
        const { viewport, backend, termScreen } = createViewport(10, 3, 20);
        renderViewport(viewport, termScreen, backend);

        expectScreen(
            backend,
            screen`
                Line 001
                Line 002
                Line 003
            `,
        );
    });

    it("clips content beyond viewport height", () => {
        const { viewport, child, backend, termScreen } = createViewport(10, 3, 20);
        child.scrollTop = 0;
        renderViewport(viewport, termScreen, backend);

        // Only 3 lines should be visible, lines 4+ should be clipped
        const output = backend.screenToString();
        const lines = output.split("\n");
        // First 3 lines have content
        expect(lines[0].trimEnd()).toBe("Line 001");
        expect(lines[1].trimEnd()).toBe("Line 002");
        expect(lines[2].trimEnd()).toBe("Line 003");
    });

    it("shifts content by scrollTop", () => {
        const { viewport, child, backend, termScreen } = createViewport(10, 3, 20);
        child.scrollTop = 5;
        renderViewport(viewport, termScreen, backend);

        expectScreen(
            backend,
            screen`
                Line 006
                Line 007
                Line 008
            `,
        );
    });

    it("shows last lines when scrolled to bottom", () => {
        const { viewport, child, backend, termScreen } = createViewport(10, 3, 10);
        child.scrollTop = 7; // 10 - 3 = 7
        renderViewport(viewport, termScreen, backend);

        expectScreen(
            backend,
            screen`
                Line 008
                Line 009
                Line 010
            `,
        );
    });

    it("shows all content when contentHeight <= viewport", () => {
        const { viewport, backend, termScreen } = createViewport(10, 5, 3);
        renderViewport(viewport, termScreen, backend);

        expectScreen(
            backend,
            screen`
                Line 001
                Line 002
                Line 003
            `,
        );
    });

    it("delegates contentHeight from child", () => {
        const { viewport } = createViewport(10, 5, 42);
        expect(viewport.contentHeight).toBe(42);
    });

    it("delegates scrollTop from child", () => {
        const { viewport, child } = createViewport(10, 5, 20);
        child.scrollTop = 7;
        expect(viewport.scrollTop).toBe(7);
    });

    it("sets child globalPosition from viewport globalPosition", () => {
        const { viewport, child } = createViewport(10, 5, 20);
        viewport.globalPosition = new Point(3, 7);
        viewport.performLayout(BoxConstraints.tight(new Size(10, 5)));
        expect(child.globalPosition).toEqual(new Point(3, 7));
    });

    it("renders correctly when viewport is offset on screen", () => {
        const size = new Size(20, 6);
        const backend = new MockTerminalBackend(size);
        const termScreen = new TerminalScreen(size);
        const child = new FullContentWidget(10);
        child.scrollTop = 2;
        const viewport = new ScrollViewport(child);

        viewport.globalPosition = new Point(5, 1);
        viewport.performLayout(BoxConstraints.tight(new Size(10, 3)));

        const clipRect = new Rect(new Point(0, 0), size);
        viewport.render(new RenderContext(termScreen, new Offset(5, 1), clipRect));
        termScreen.flush(backend);

        // Lines 3,4,5 should appear at columns 5-14, rows 1-3
        const lines = backend.screenToString().split("\n");
        expect(lines[1].slice(5, 13).trimEnd()).toBe("Line 003");
        expect(lines[2].slice(5, 13).trimEnd()).toBe("Line 004");
        expect(lines[3].slice(5, 13).trimEnd()).toBe("Line 005");
    });

    it("delegates contentWidth from child", () => {
        const { viewport, child } = createViewport(10, 5, 20);
        expect(viewport.contentWidth).toBe(child.contentWidth);
    });

    it("delegates scrollLeft from child", () => {
        const { viewport, child } = createViewport(10, 5, 20);
        child.scrollLeft = 3;
        expect(viewport.scrollLeft).toBe(3);
    });

    it("shifts content horizontally by scrollLeft", () => {
        const { viewport, child, backend, termScreen } = createViewport(5, 3, 20);
        // "Line 001" has 8 chars, scroll right by 3 → show "e 00"
        child.scrollLeft = 3;
        renderViewport(viewport, termScreen, backend);

        const lines = backend.screenToString().split("\n");
        expect(lines[0].trimEnd()).toBe("e 001");
        expect(lines[1].trimEnd()).toBe("e 002");
        expect(lines[2].trimEnd()).toBe("e 003");
    });

    it("shifts content both horizontally and vertically", () => {
        const { viewport, child, backend, termScreen } = createViewport(5, 3, 20);
        child.scrollLeft = 3;
        child.scrollTop = 5;
        renderViewport(viewport, termScreen, backend);

        const lines = backend.screenToString().split("\n");
        expect(lines[0].trimEnd()).toBe("e 006");
        expect(lines[1].trimEnd()).toBe("e 007");
        expect(lines[2].trimEnd()).toBe("e 008");
    });
});
