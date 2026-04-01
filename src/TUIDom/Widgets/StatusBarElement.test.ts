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
