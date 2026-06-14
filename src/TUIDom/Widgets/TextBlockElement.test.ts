import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { RenderContext } from "../TUIElement.ts";

import { TextBlockElement } from "./TextBlockElement.ts";

function renderBlock(block: TextBlockElement, width: number, height: number): MockTerminalBackend {
    const size = new Size(width, height);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    block.globalPosition = new Point(0, 0);
    block.performLayout(BoxConstraints.tight(size));
    block.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

describe("TextBlockElement", () => {
    it("generates numbered lines and exposes content size", () => {
        const block = new TextBlockElement(3);
        expect(block.contentHeight).toBe(3);
        // "Line 001" → 8 columns wide.
        expect(block.contentWidth).toBe(8);
        expect(block.getMinIntrinsicWidth(1)).toBe(8);
        expect(block.getMaxIntrinsicWidth(1)).toBe(8);
        expect(block.getMinIntrinsicHeight(1)).toBe(3);
        expect(block.getMaxIntrinsicHeight(1)).toBe(3);
    });

    it("renders each generated line on its own row", () => {
        const block = new TextBlockElement(2);
        const backend = renderBlock(block, 8, 2);
        expect(backend.getTextAt(new Point(0, 0), 8)).toBe("Line 001");
        expect(backend.getTextAt(new Point(0, 1), 8)).toBe("Line 002");
    });

    it("renders blank rows past the generated lines when contentHeight exceeds line count", () => {
        const block = new TextBlockElement(1);
        // Force more rows than there are generated lines, exercising the empty-line branch.
        block.contentHeight = 3;
        const backend = renderBlock(block, 8, 3);

        expect(backend.getTextAt(new Point(0, 0), 8)).toBe("Line 001");
        // Rows 1 and 2 have no backing line → rendered as blanks.
        expect(backend.getTextAt(new Point(0, 1), 8).trim()).toBe("");
        expect(backend.getTextAt(new Point(0, 2), 8).trim()).toBe("");
    });
});
