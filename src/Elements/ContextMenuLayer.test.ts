import { describe, it, expect } from "vitest";

import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { BoxConstraints, Point, Size } from "../Common/GeometryPromitives.ts";
import { MockTerminalBackend } from "../TerminalBackend/MockTerminalBackend.ts";
import { createKeyPressEvent } from "../TerminalBackend/KeyEvent.ts";
import { expectScreen, screen } from "../TestUtils/expectScreen.ts";

import { ContextMenuLayer } from "./ContextMenuLayer.ts";
import { BoxElement } from "./BoxElement.ts";
import { RenderContext } from "./TUIElement.ts";

function renderLayer(
    layerWidth: number,
    layerHeight: number,
    setup: (layer: ContextMenuLayer) => void,
): MockTerminalBackend {
    const size = new Size(layerWidth, layerHeight);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);

    const layer = new ContextMenuLayer();
    layer.globalPosition = new Point(0, 0);
    setup(layer);
    layer.performLayout(BoxConstraints.tight(size));
    layer.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

describe("ContextMenuLayer", () => {
    it("renders nothing when no items", () => {
        const backend = renderLayer(10, 3, () => {});
        const screenStr = backend.screenToString();
        // All spaces
        expect(screenStr.includes("+")).toBe(false);
        expect(screenStr.includes("-")).toBe(false);
    });

    it("does not render invisible items", () => {
        const backend = renderLayer(10, 5, (layer) => {
            const box = new BoxElement();
            layer.addItem(box, new Point(0, 0), false);
        });
        // All spaces — box is invisible
        const screenStr = backend.screenToString();
        expect(screenStr.includes("+")).toBe(false);
    });

    it("renders visible item at specified position", () => {
        const backend = renderLayer(80, 24, (layer) => {
            const box = new BoxElement();
            layer.addItem(box, new Point(2, 1), true);
        });
        const screenStr = backend.screenToString();
        const lines = screenStr.split("\n");
        // Box top-left corner at column 2, row 1
        expect(lines[1][2]).toBe("+");
        // Row 0 should be blank at col 2 (box doesn't start until row 1)
        expect(lines[0][2]).toBe(" ");
    });

    it("does not render item after making it invisible", () => {
        const size = new Size(10, 5);
        const backend = new MockTerminalBackend(size);
        const termScreen = new TerminalScreen(size);

        const layer = new ContextMenuLayer();
        layer.globalPosition = new Point(0, 0);
        const box = new BoxElement();
        layer.addItem(box, new Point(0, 0), true);
        layer.setVisible(box, false);

        layer.performLayout(BoxConstraints.tight(size));
        layer.render(new RenderContext(termScreen));
        termScreen.flush(backend);

        const screenStr = backend.screenToString();
        expect(screenStr.includes("+")).toBe(false);
    });

    it("hasVisibleItems returns false when empty", () => {
        const layer = new ContextMenuLayer();
        expect(layer.hasVisibleItems()).toBe(false);
    });

    it("hasVisibleItems returns false when all hidden", () => {
        const layer = new ContextMenuLayer();
        const box = new BoxElement();
        layer.addItem(box, new Point(0, 0), false);
        expect(layer.hasVisibleItems()).toBe(false);
    });

    it("hasVisibleItems returns true when any visible", () => {
        const layer = new ContextMenuLayer();
        const box = new BoxElement();
        layer.addItem(box, new Point(0, 0), true);
        expect(layer.hasVisibleItems()).toBe(true);
    });

    it("emits events to visible items only", () => {
        const layer = new ContextMenuLayer();
        const keys1: string[] = [];
        const keys2: string[] = [];

        const box1 = new BoxElement();
        box1.addEventListener("keydown", (e) => keys1.push(e.key));

        const box2 = new BoxElement();
        box2.addEventListener("keydown", (e) => keys2.push(e.key));

        layer.addItem(box1, new Point(0, 0), true);
        layer.addItem(box2, new Point(0, 0), false);

        layer.emit(createKeyPressEvent("a", "a"));

        expect(keys1).toEqual(["a"]);
        expect(keys2).toEqual([]); // invisible — no events
    });

    it("removes item", () => {
        const layer = new ContextMenuLayer();
        const box = new BoxElement();
        layer.addItem(box, new Point(0, 0), true);
        layer.removeItem(box);
        expect(layer.hasVisibleItems()).toBe(false);
        expect(layer.getItems().length).toBe(0);
    });

    it("clearAll removes all items", () => {
        const layer = new ContextMenuLayer();
        layer.addItem(new BoxElement(), new Point(0, 0), true);
        layer.addItem(new BoxElement(), new Point(5, 5), true);
        layer.clearAll();
        expect(layer.getItems().length).toBe(0);
        expect(layer.hasVisibleItems()).toBe(false);
    });
});
