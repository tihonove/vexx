import { describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { RenderContext } from "../TUIElement.ts";

import type { ButtonElement } from "./ButtonElement.ts";
import { FindWidgetElement } from "./FindWidgetElement.ts";

const WIDTH = 44;

// ButtonElement defaults (no theme applied).
const BUTTON_BG = packRgb(60, 60, 60);
const BUTTON_HOVER_BG = packRgb(69, 73, 78);

/** Lays out + renders the widget into a backend so button positions/colors are populated. */
function render(widget: FindWidgetElement, width = WIDTH): MockTerminalBackend {
    const size = new Size(width, 3);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    widget.globalPosition = new Point(0, 0);
    widget.performLayout(BoxConstraints.tight(size));
    widget.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

/** The three nav buttons in order: [prev, next, close]. */
function buttons(widget: FindWidgetElement): ButtonElement[] {
    return widget.querySelectorAll("ButtonElement") as ButtonElement[];
}

function mouse(type: "click" | "mouseenter" | "mouseleave", x = 0, y = 0): TUIMouseEvent {
    return new TUIMouseEvent(type, { button: "left", screenX: x, screenY: y, localX: 0, localY: 0 });
}

/** Resolves the element at a screen point and dispatches a left click on it. */
function clickAt(widget: FindWidgetElement, x: number, y: number): void {
    const target = widget.elementFromPoint(new Point(x, y));
    target?.dispatchEvent(mouse("click", x, y));
}

describe("FindWidgetElement — intrinsic sizing", () => {
    it("reports a fixed min width and preferred-width max width", () => {
        const widget = new FindWidgetElement();
        widget.preferredWidth = 50;
        expect(widget.getMinIntrinsicWidth(3)).toBe(30);
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
    it("invokes onPrev / onNext / onClose when the matching button is clicked", () => {
        const widget = new FindWidgetElement();
        const onPrev = vi.fn();
        const onNext = vi.fn();
        const onClose = vi.fn();
        widget.onPrev = onPrev;
        widget.onNext = onNext;
        widget.onClose = onClose;
        render(widget);

        const [prev, next, close] = buttons(widget);
        clickAt(widget, prev.globalPosition.x, prev.globalPosition.y);
        clickAt(widget, next.globalPosition.x, next.globalPosition.y);
        clickAt(widget, close.globalPosition.x, close.globalPosition.y);

        expect(onPrev).toHaveBeenCalledOnce();
        expect(onNext).toHaveBeenCalledOnce();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("ignores clicks that land on the input rather than a button", () => {
        const widget = new FindWidgetElement();
        const onClose = vi.fn();
        widget.onClose = onClose;
        render(widget);

        // Column 2, row 1 sits inside the query input, not on a button.
        clickAt(widget, 2, 1);

        expect(onClose).not.toHaveBeenCalled();
    });
});

describe("FindWidgetElement — hover", () => {
    it("highlights a button on mouseenter and reverts on mouseleave", () => {
        const widget = new FindWidgetElement();
        render(widget);
        const next = buttons(widget)[1];
        const x = next.globalPosition.x;

        next.dispatchEvent(mouse("mouseenter"));
        expect(render(widget).getBgAt(new Point(x, 1))).toBe(BUTTON_HOVER_BG);

        next.dispatchEvent(mouse("mouseleave"));
        expect(render(widget).getBgAt(new Point(x, 1))).toBe(BUTTON_BG);
    });
});

describe("FindWidgetElement — applyTheme", () => {
    it("pushes the theme's secondary button colors into the buttons", () => {
        const SECONDARY_BG = packRgb(11, 22, 33);
        const SECONDARY_HOVER_BG = packRgb(44, 55, 66);
        const theme = new WorkbenchTheme(
            "test",
            "dark",
            {
                "button.secondaryBackground": SECONDARY_BG,
                "button.secondaryForeground": packRgb(200, 200, 200),
                "button.secondaryHoverBackground": SECONDARY_HOVER_BG,
            },
            { rules: [] },
        );

        const widget = new FindWidgetElement();
        widget.applyTheme(theme);
        render(widget);

        const close = buttons(widget)[2];
        const x = close.globalPosition.x;
        expect(render(widget).getBgAt(new Point(x, 1))).toBe(SECONDARY_BG);

        close.dispatchEvent(mouse("mouseenter"));
        expect(render(widget).getBgAt(new Point(x, 1))).toBe(SECONDARY_HOVER_BG);
    });
});
