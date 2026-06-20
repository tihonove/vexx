import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Offset, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { RenderContext } from "../TUIElement.ts";

import { StatusBarElement } from "./StatusBarElement.ts";

function renderStatusBar(width: number, items: { text: string }[] = []): MockTerminalBackend {
    const size = new Size(width, 1);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    const bar = new StatusBarElement();
    bar.globalPosition = new Point(0, 0);
    bar.setItems(items);
    bar.performLayout(BoxConstraints.tight(new Size(width, 10)));
    bar.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

describe("StatusBarElement", () => {
    it("has height 1 regardless of constraints", () => {
        const bar = new StatusBarElement();
        const resultSize = bar.performLayout(BoxConstraints.tight(new Size(80, 24)));
        expect(resultSize.height).toBe(1);
        expect(resultSize.width).toBe(80);
    });

    it("renders empty bar with spaces", () => {
        const backend = renderStatusBar(10);
        const screenText = backend.screenToString().split("\n")[0];
        expect(screenText.trim()).toBe("");
    });

    it("renders single item text", () => {
        const backend = renderStatusBar(20, [{ text: "hello.ts" }]);
        const screenText = backend.screenToString().split("\n")[0];
        expect(screenText).toContain("hello.ts");
    });

    it("renders multiple items separated by double space", () => {
        const backend = renderStatusBar(30, [{ text: "file.ts" }, { text: "[Modified]" }]);
        const screenText = backend.screenToString().split("\n")[0];
        expect(screenText).toContain("file.ts  [Modified]");
    });

    it("setItems triggers markDirty", () => {
        const bar = new StatusBarElement();
        bar.performLayout(BoxConstraints.tight(new Size(40, 1)));
        expect(bar.isLayoutDirty).toBe(false);

        bar.setItems([{ text: "test" }]);
        expect(bar.isLayoutDirty).toBe(true);
    });

    it("getItems returns current items", () => {
        const bar = new StatusBarElement();
        expect(bar.getItems()).toEqual([]);

        const items = [{ text: "a" }, { text: "b" }];
        bar.setItems(items);
        expect(bar.getItems()).toEqual(items);
    });

    it("truncates text that exceeds width", () => {
        const backend = renderStatusBar(5, [{ text: "longtext" }]);
        const screenText = backend.screenToString().split("\n")[0];
        expect(screenText.length).toBeLessThanOrEqual(5);
    });

    it("right-aligns items flush to the right edge, left items winning on overlap", () => {
        const size = new Size(20, 1);
        const backend = new MockTerminalBackend(size);
        const termScreen = new TerminalScreen(size);
        const bar = new StatusBarElement();
        bar.globalPosition = new Point(0, 0);
        bar.setItems([{ text: "left" }, { text: "Ln 1, Col 1", align: "right" }]);
        bar.performLayout(BoxConstraints.tight(new Size(20, 1)));
        bar.render(new RenderContext(termScreen));
        termScreen.flush(backend);

        const line = backend.screenToString().split("\n")[0];
        expect(line.length).toBe(20);
        expect(line.startsWith("left")).toBe(true);
        expect(line.endsWith("Ln 1, Col 1")).toBe(true);
    });

    function renderLine(width: number, items: { text: string; align?: "left" | "right" }[]): string {
        const size = new Size(width, 1);
        const backend = new MockTerminalBackend(size);
        const termScreen = new TerminalScreen(size);
        const bar = new StatusBarElement();
        bar.globalPosition = new Point(0, 0);
        bar.setItems(items);
        bar.performLayout(BoxConstraints.tight(new Size(width, 1)));
        bar.render(new RenderContext(termScreen));
        termScreen.flush(backend);
        return backend.screenToString().split("\n")[0];
    }

    it("lets the left item win the cells a right item would overlap", () => {
        // width 10, left "LLLLLLLL" (8), right "RGHT" (4) → rightStart=6, cells 6–7
        // belong to the left item, only 8–9 ("HT") are drawn for the right item.
        const line = renderLine(10, [{ text: "LLLLLLLL" }, { text: "RGHT", align: "right" }]);
        expect(line).toBe("LLLLLLLLHT");
    });

    it("clips a right item that is wider than the bar at the left edge", () => {
        // width 5, right "TOOLONG" (7) → rightStart=-2, the first two cells fall
        // off the left edge and are skipped; the tail "OLONG" survives.
        const line = renderLine(5, [{ text: "TOOLONG", align: "right" }]);
        expect(line).toBe("OLONG");
    });

    it("intrinsic width sums left, a two-space gap and right", () => {
        const bar = new StatusBarElement();
        bar.setItems([{ text: "abc" }, { text: "xy", align: "right" }]);
        // "abc" (3) + gap (2) + "xy" (2) = 7
        expect(bar.getMinIntrinsicWidth(1)).toBe(7);
        expect(bar.getMaxIntrinsicWidth(1)).toBe(7);
    });

    it("renders with correct offset", () => {
        const size = new Size(20, 3);
        const backend = new MockTerminalBackend(size);
        const termScreen = new TerminalScreen(size);
        const bar = new StatusBarElement();
        bar.globalPosition = new Point(0, 2);
        bar.setItems([{ text: "bottom" }]);
        bar.performLayout(BoxConstraints.tight(new Size(20, 10)));
        bar.render(new RenderContext(termScreen, new Offset(0, 2)));
        termScreen.flush(backend);

        const lines = backend.screenToString().split("\n");
        expect(lines[2]).toContain("bottom");
    });
});
