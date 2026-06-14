import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { RenderContext } from "../TUIElement.ts";

import { TextLabelElement } from "./TextLabelElement.ts";

function render(label: TextLabelElement, width: number): MockTerminalBackend {
    const size = new Size(width, 1);
    const screen = new TerminalScreen(size);
    const backend = new MockTerminalBackend(size);
    label.globalPosition = new Point(0, 0);
    label.performLayout(BoxConstraints.tight(size));
    label.performStyleResolution(label.resolvedStyle);
    label.render(new RenderContext(screen));
    screen.flush(backend);
    return backend;
}

describe("TextLabelElement", () => {
    it("exposes the original text via getText()", () => {
        const label = new TextLabelElement("hello");
        expect(label.getText()).toBe("hello");
    });

    it("updates text via setText() and re-renders the new value", () => {
        const label = new TextLabelElement("old");
        label.setText("new");
        expect(label.getText()).toBe("new");

        const backend = render(label, 5);
        expect(backend.getTextAt(new Point(0, 0), 3)).toBe("new");
    });

    it("reports min intrinsic width equal to the display width of the text", () => {
        const label = new TextLabelElement("abcde");
        expect(label.getMinIntrinsicWidth(1)).toBe(5);
        expect(label.getMaxIntrinsicWidth(1)).toBe(5);
    });

    it("reports a single-row min/max intrinsic height", () => {
        const label = new TextLabelElement("abc");
        expect(label.getMinIntrinsicHeight(10)).toBe(1);
        expect(label.getMaxIntrinsicHeight(10)).toBe(1);
    });

    it("renders per-character styles on the targeted offset", () => {
        const label = new TextLabelElement("abc");
        label.setCharStyle(1, { fg: 42 });

        const backend = render(label, 3);

        expect(backend.getTextAt(new Point(0, 0), 3)).toBe("abc");
        expect(backend.getFgAt(new Point(1, 0))).toBe(42);
    });
});
