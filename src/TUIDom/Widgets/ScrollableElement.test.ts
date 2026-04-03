import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { expectScreen, screen } from "../../TestUtils/expectScreen.ts";
import { RenderContext } from "../TUIElement.ts";

import { ScrollableElement, type ScrollViewportInfo } from "./ScrollableElement.ts";

class LargeGridWidget extends ScrollableElement {
    private gridWidth: number;
    private gridHeight: number;

    public constructor(gridWidth: number, gridHeight: number) {
        super();
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
    }

    public get contentHeight(): number {
        return this.gridHeight;
    }

    public get contentWidth(): number {
        return this.gridWidth;
    }

    protected renderViewport(context: RenderContext, viewport: ScrollViewportInfo): void {
        for (let screenY = 0; screenY < viewport.viewportHeight; screenY++) {
            const contentY = viewport.scrollTop + screenY;
            if (contentY >= this.gridHeight) break;

            for (let screenX = 0; screenX < viewport.viewportWidth; screenX++) {
                const contentX = viewport.scrollLeft + screenX;
                if (contentX >= this.gridWidth) break;

                const char = String((contentX + contentY) % 10);
                context.setCell(screenX, screenY, { char });
            }
        }
    }
}

function createGrid(
    screenWidth: number,
    screenHeight: number,
    gridWidth: number,
    gridHeight: number,
): {
    widget: LargeGridWidget;
    backend: MockTerminalBackend;
    termScreen: TerminalScreen;
} {
    const size = new Size(screenWidth, screenHeight);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    const widget = new LargeGridWidget(gridWidth, gridHeight);
    return { widget, backend, termScreen };
}

function renderWidget(
    widget: LargeGridWidget,
    termScreen: TerminalScreen,
    backend: MockTerminalBackend,
): void {
    widget.globalPosition = new Point(0, 0);
    widget.performLayout(BoxConstraints.tight(termScreen.size));
    const clipRect = new Rect(new Point(0, 0), termScreen.size);
    widget.render(new RenderContext(termScreen, new Offset(0, 0), clipRect));
    termScreen.flush(backend);
}

describe("ScrollableElement", () => {
    describe("scrollTo", () => {
        it("clamps scrollTop to valid range", () => {
            const { widget, termScreen } = createGrid(5, 3, 20, 10);
            widget.globalPosition = new Point(0, 0);
            widget.performLayout(BoxConstraints.tight(termScreen.size));

            widget.scrollTo(0, -5);
            expect(widget.scrollTop).toBe(0);

            widget.scrollTo(0, 100);
            expect(widget.scrollTop).toBe(7); // 10 - 3 = 7

            widget.scrollTo(0, 5);
            expect(widget.scrollTop).toBe(5);
        });

        it("clamps scrollLeft to valid range", () => {
            const { widget, termScreen } = createGrid(5, 3, 20, 10);
            widget.globalPosition = new Point(0, 0);
            widget.performLayout(BoxConstraints.tight(termScreen.size));

            widget.scrollTo(-5, 0);
            expect(widget.scrollLeft).toBe(0);

            widget.scrollTo(100, 0);
            expect(widget.scrollLeft).toBe(15); // 20 - 5 = 15

            widget.scrollTo(10, 0);
            expect(widget.scrollLeft).toBe(10);
        });

        it("clamps both axes at once", () => {
            const { widget, termScreen } = createGrid(5, 3, 20, 10);
            widget.globalPosition = new Point(0, 0);
            widget.performLayout(BoxConstraints.tight(termScreen.size));

            widget.scrollTo(100, 100);
            expect(widget.scrollLeft).toBe(15);
            expect(widget.scrollTop).toBe(7);
        });

        it("allows zero when content fits viewport", () => {
            const { widget, termScreen } = createGrid(10, 10, 5, 3);
            widget.globalPosition = new Point(0, 0);
            widget.performLayout(BoxConstraints.tight(termScreen.size));

            widget.scrollTo(5, 5);
            expect(widget.scrollLeft).toBe(0);
            expect(widget.scrollTop).toBe(0);
        });
    });

    describe("scrollBy", () => {
        it("scrolls relative to current position", () => {
            const { widget, termScreen } = createGrid(5, 3, 20, 10);
            widget.globalPosition = new Point(0, 0);
            widget.performLayout(BoxConstraints.tight(termScreen.size));

            widget.scrollBy(3, 2);
            expect(widget.scrollLeft).toBe(3);
            expect(widget.scrollTop).toBe(2);

            widget.scrollBy(1, 1);
            expect(widget.scrollLeft).toBe(4);
            expect(widget.scrollTop).toBe(3);
        });

        it("clamps when scrolling beyond bounds", () => {
            const { widget, termScreen } = createGrid(5, 3, 20, 10);
            widget.globalPosition = new Point(0, 0);
            widget.performLayout(BoxConstraints.tight(termScreen.size));

            widget.scrollBy(-10, -10);
            expect(widget.scrollLeft).toBe(0);
            expect(widget.scrollTop).toBe(0);
        });
    });

    describe("render", () => {
        it("renders top-left corner when scroll is at origin", () => {
            const { widget, backend, termScreen } = createGrid(5, 3, 20, 10);
            renderWidget(widget, termScreen, backend);

            // (x+y) % 10 for each cell
            // y=0: 0 1 2 3 4
            // y=1: 1 2 3 4 5
            // y=2: 2 3 4 5 6
            expectScreen(
                backend,
                screen`
                    01234
                    12345
                    23456
                `,
            );
        });

        it("renders with vertical scroll offset", () => {
            const { widget, backend, termScreen } = createGrid(5, 3, 20, 10);
            widget.globalPosition = new Point(0, 0);
            widget.performLayout(BoxConstraints.tight(termScreen.size));
            widget.scrollTo(0, 5);

            renderWidget(widget, termScreen, backend);

            // y=5: 5 6 7 8 9
            // y=6: 6 7 8 9 0
            // y=7: 7 8 9 0 1
            expectScreen(
                backend,
                screen`
                    56789
                    67890
                    78901
                `,
            );
        });

        it("renders with horizontal scroll offset", () => {
            const { widget, backend, termScreen } = createGrid(5, 3, 20, 10);
            widget.globalPosition = new Point(0, 0);
            widget.performLayout(BoxConstraints.tight(termScreen.size));
            widget.scrollTo(7, 0);

            renderWidget(widget, termScreen, backend);

            // x starts at 7
            // y=0: 7 8 9 0 1
            // y=1: 8 9 0 1 2
            // y=2: 9 0 1 2 3
            expectScreen(
                backend,
                screen`
                    78901
                    89012
                    90123
                `,
            );
        });

        it("renders with both scroll offsets", () => {
            const { widget, backend, termScreen } = createGrid(5, 3, 20, 10);
            widget.globalPosition = new Point(0, 0);
            widget.performLayout(BoxConstraints.tight(termScreen.size));
            widget.scrollTo(4, 3);

            renderWidget(widget, termScreen, backend);

            // x starts at 4, y starts at 3
            // y=3, x=4: (4+3)%10=7  (5+3)=8  (6+3)=9  (7+3)=0  (8+3)=1
            // y=4, x=4: (4+4)%10=8  ...
            // y=5, x=4: (4+5)%10=9  ...
            expectScreen(
                backend,
                screen`
                    78901
                    89012
                    90123
                `,
            );
        });

        it("handles content smaller than viewport", () => {
            const { widget, backend, termScreen } = createGrid(10, 5, 3, 2);
            renderWidget(widget, termScreen, backend);

            const lines = backend.screenToString().split("\n");
            expect(lines[0].slice(0, 3)).toBe("012");
            expect(lines[1].slice(0, 3)).toBe("123");
        });
    });
});
