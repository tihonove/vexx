import { describe, expect, it, vi } from "vitest";

import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { RenderContext } from "../TUIElement.ts";

import { FindWidgetElement } from "./FindWidgetElement.ts";

const WIDTH = 44;

/** Lays out + renders the widget at a fixed width so the button hit-test X's are populated. */
function render(widget: FindWidgetElement): void {
    const size = new Size(WIDTH, 3);
    widget.globalPosition = new Point(0, 0);
    widget.performLayout(BoxConstraints.tight(size));
    widget.render(new RenderContext(new TerminalScreen(size)));
}

function mousedown(widget: FindWidgetElement, localX: number, localY = 1): TUIMouseEvent {
    const event = new TUIMouseEvent("mousedown", {
        button: "left",
        screenX: localX,
        screenY: localY,
        localX,
        localY,
    });
    widget.dispatchEvent(event);
    return event;
}

// At width 44 with an empty input the right block is just the 6-cell "↑ ↓ ✕" nav
// (✕ is double-width), so navStart = 44 - 1 - 6 = 37 → prev=37, next=39, close=41.
const PREV_X = 37;
const NEXT_X = 39;
const CLOSE_X = 41;

describe("FindWidgetElement — intrinsic sizing", () => {
    it("reports a fixed min width and preferred-width max width", () => {
        const widget = new FindWidgetElement();
        widget.preferredWidth = 50;
        expect(widget.getMinIntrinsicWidth(3)).toBe(24);
        expect(widget.getMaxIntrinsicWidth(3)).toBe(50);
    });

    it("reports a fixed height of 3 rows", () => {
        const widget = new FindWidgetElement();
        expect(widget.getMinIntrinsicHeight(WIDTH)).toBe(3);
        expect(widget.getMaxIntrinsicHeight(WIDTH)).toBe(3);
    });

    it("falls back to the preferred width under unbounded constraints", () => {
        const widget = new FindWidgetElement();
        widget.preferredWidth = 40;
        const size = widget.performLayout(new BoxConstraints(0, Infinity, 0, 3));
        expect(size).toEqual(new Size(40, 3));
    });
});

describe("FindWidgetElement — button clicks", () => {
    it("invokes onClose and prevents default when the ✕ button is clicked", () => {
        const widget = new FindWidgetElement();
        const onClose = vi.fn();
        widget.onClose = onClose;
        render(widget);

        const event = mousedown(widget, CLOSE_X);

        expect(onClose).toHaveBeenCalledOnce();
        expect(event.defaultPrevented).toBe(true);
    });

    it("invokes onNext when the ↓ button is clicked", () => {
        const widget = new FindWidgetElement();
        const onNext = vi.fn();
        widget.onNext = onNext;
        render(widget);

        mousedown(widget, NEXT_X);

        expect(onNext).toHaveBeenCalledOnce();
    });

    it("invokes onPrev when the ↑ button is clicked", () => {
        const widget = new FindWidgetElement();
        const onPrev = vi.fn();
        widget.onPrev = onPrev;
        render(widget);

        mousedown(widget, PREV_X);

        expect(onPrev).toHaveBeenCalledOnce();
    });

    it("ignores clicks that miss the button row", () => {
        const widget = new FindWidgetElement();
        const onClose = vi.fn();
        widget.onClose = onClose;
        render(widget);

        // Same column as ✕ but on the border row (y=0), and an empty column on the input row.
        mousedown(widget, CLOSE_X, 0);
        mousedown(widget, 5, 1);

        expect(onClose).not.toHaveBeenCalled();
    });
});
