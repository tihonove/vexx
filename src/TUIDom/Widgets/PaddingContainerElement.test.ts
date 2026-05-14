import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR, packRgb } from "../../Rendering/ColorUtils.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { ROOT_RESOLVED_STYLE } from "../Styles/TUIStyle.ts";
import { expectScreen, screen } from "../../TestUtils/expectScreen.ts";
import { RenderContext } from "../TUIElement.ts";

import { BoxElement } from "./BoxElement.ts";
import { PaddingContainerElement } from "./PaddingContainerElement.ts";

function layoutAndRender(element: PaddingContainerElement, width: number, height: number): MockTerminalBackend {
    const size = new Size(width, height);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);

    element.globalPosition = new Point(0, 0);
    element.performLayout(BoxConstraints.tight(size));
    element.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

describe("PaddingContainerElement", () => {
    it("computes child size with top and left padding", () => {
        const box = new BoxElement();
        const padded = new PaddingContainerElement(box, { top: 1, left: 1 });

        padded.globalPosition = new Point(0, 0);
        padded.performLayout(BoxConstraints.tight(new Size(8, 5)));

        expect(box.layoutSize.width).toBe(7); // 8 - 1 left
        expect(box.layoutSize.height).toBe(4); // 5 - 1 top
    });

    it("computes child size with all paddings", () => {
        const box = new BoxElement();
        const padded = new PaddingContainerElement(box, { top: 2, left: 3, right: 1, bottom: 1 });

        padded.globalPosition = new Point(0, 0);
        padded.performLayout(BoxConstraints.tight(new Size(20, 10)));

        expect(box.layoutSize.width).toBe(16); // 20 - 3 - 1
        expect(box.layoutSize.height).toBe(7); // 10 - 2 - 1
    });

    it("sets child globalPosition with padding offset", () => {
        const box = new BoxElement();
        const padded = new PaddingContainerElement(box, { top: 2, left: 3 });

        padded.globalPosition = new Point(5, 10);
        padded.performLayout(BoxConstraints.tight(new Size(20, 10)));

        expect(box.globalPosition.x).toBe(8); // 5 + 3
        expect(box.globalPosition.y).toBe(12); // 10 + 2
    });

    it("renders child without padding (defaults to 0)", () => {
        const box = new BoxElement();
        const padded = new PaddingContainerElement(box);

        const backend = layoutAndRender(padded, 6, 4);

        expectScreen(
            backend,
            screen`
                +----+
                |    |
                |    |
                +----+
            `,
        );
    });

    it("renders child shifted by padding", () => {
        const box = new BoxElement();
        const padded = new PaddingContainerElement(box, { top: 1, left: 1 });

        const backend = layoutAndRender(padded, 8, 5);

        // Row 0: empty (top padding) — nothing drawn
        // Rows 1-4: box shifted right by 1 (left padding)
        expect(backend.getTextAt(new Point(1, 1), 7)).toBe("+-----+");
        expect(backend.getTextAt(new Point(1, 2), 7)).toBe("|     |");
        expect(backend.getTextAt(new Point(1, 3), 7)).toBe("|     |");
        expect(backend.getTextAt(new Point(1, 4), 7)).toBe("+-----+");
    });

    it("clamps child size to zero when padding exceeds container", () => {
        const box = new BoxElement();
        const padded = new PaddingContainerElement(box, { top: 10, left: 10 });

        padded.globalPosition = new Point(0, 0);
        padded.performLayout(BoxConstraints.tight(new Size(5, 5)));

        expect(box.layoutSize.width).toBe(0);
        expect(box.layoutSize.height).toBe(0);
    });

    it("renders padding cells with explicit bg color, not transparent", () => {
        const BG = packRgb(37, 37, 38);
        const padded = new PaddingContainerElement(null, { top: 1, bottom: 1, left: 2, right: 2 });
        padded.style = { bg: BG };

        const size = new Size(8, 4);
        const backend = new MockTerminalBackend(size);
        const termScreen = new TerminalScreen(size);

        padded.globalPosition = new Point(0, 0);
        padded.performStyleResolution(ROOT_RESOLVED_STYLE);
        padded.performLayout(BoxConstraints.tight(size));
        padded.render(new RenderContext(termScreen));
        termScreen.flush(backend);

        // Top padding row
        expect(backend.getBgAt(new Point(0, 0))).toBe(BG);
        expect(backend.getBgAt(new Point(0, 0))).not.toBe(DEFAULT_COLOR);
        // Bottom padding row
        expect(backend.getBgAt(new Point(0, 3))).toBe(BG);
        // Left padding column (middle rows)
        expect(backend.getBgAt(new Point(0, 1))).toBe(BG);
        expect(backend.getBgAt(new Point(1, 1))).toBe(BG);
        // Right padding column (middle rows)
        expect(backend.getBgAt(new Point(6, 1))).toBe(BG);
        expect(backend.getBgAt(new Point(7, 1))).toBe(BG);
    });
});
