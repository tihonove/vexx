import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { RenderContext } from "../TUIElement.ts";

import { DEFAULT_COLOR } from "../../Rendering/ColorUtils.ts";

import { TextLabel, TextLabelElement } from "./TextLabelElement.ts";

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

    describe("TextLabel JSX adapter", () => {
        it("falls back to DEFAULT_COLOR when fg/bg are omitted", () => {
            const label = TextLabel({ text: "hi" });
            expect(label).toBeInstanceOf(TextLabelElement);
            expect(label.getText()).toBe("hi");

            const backend = render(label, 2);
            expect(backend.getTextAt(new Point(0, 0), 2)).toBe("hi");
            expect(backend.getFgAt(new Point(0, 0))).toBe(DEFAULT_COLOR);
            expect(backend.getBgAt(new Point(0, 0))).toBe(DEFAULT_COLOR);
        });

        it("applies explicit colors and per-character styles via props", () => {
            const label = TextLabel({ text: "ab", fg: 7, bg: 9, charStyles: new Map([[1, { fg: 55 }]]) });

            const backend = render(label, 2);
            expect(backend.getFgAt(new Point(0, 0))).toBe(7);
            expect(backend.getBgAt(new Point(0, 0))).toBe(9);
            expect(backend.getFgAt(new Point(1, 0))).toBe(55);
        });

        it("update() re-applies props, clearing previous per-character styles", () => {
            const label = TextLabel({ text: "ab", fg: 7, bg: 9, charStyles: new Map([[1, { fg: 55 }]]) });
            TextLabel.update(label, { text: "cd" });

            expect(label.getText()).toBe("cd");
            const backend = render(label, 2);
            expect(backend.getTextAt(new Point(0, 0), 2)).toBe("cd");
            // Previous char style at offset 1 was cleared → falls back to default fg.
            expect(backend.getFgAt(new Point(1, 0))).toBe(DEFAULT_COLOR);
        });
    });
});
