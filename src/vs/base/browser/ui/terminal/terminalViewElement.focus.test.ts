import { describe, expect, it } from "vitest";

import { Size } from "../../../../../../tuidom/common/geometryPromitives.ts";
import { TUIMouseEvent } from "../../../../../../tuidom/dom/events/tuiMouseEvent.ts";
import { FakeTerminalSurface } from "../../../../../TestUtils/FakeTerminalSurface.ts";
import { TestApp } from "../../../../../TestUtils/TestApp.ts";

import { TerminalViewElement } from "./terminalViewElement.ts";

// isFocused / фокус активны только когда элемент вшит в дерево с FocusManager,
// поэтому идём через TestApp, а не через bare-элемент, как в остальных сюитах.

function mousedown(): TUIMouseEvent {
    return new TUIMouseEvent("mousedown", {
        button: "left",
        screenX: 3,
        screenY: 2,
        localX: 3,
        localY: 2,
    });
}

describe("TerminalViewElement — focus on click", () => {
    it("focuses the terminal on mousedown (falls through to the base default action)", () => {
        const surface = new FakeTerminalSurface();
        const el = new TerminalViewElement(surface);
        const app = TestApp.createWithContent(el, new Size(20, 10));

        expect(app.focusedElement).not.toBe(el);
        el.dispatchEvent(mousedown());

        expect(app.focusedElement).toBe(el);
        // Клик по-прежнему форвардится в PTY (мышиный режим шелла), фокус этому не мешает.
        expect(surface.mouseEvents).toEqual([
            { col: 3, row: 2, button: "left", action: "down", ctrl: false, alt: false, shift: false },
        ]);
    });
});
