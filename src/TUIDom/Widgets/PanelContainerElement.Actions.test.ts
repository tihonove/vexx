import { describe, expect, it } from "vitest";

import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";
import { RenderContext } from "../TUIElement.ts";

import { PanelContainerElement, type PanelViewAction } from "./PanelContainerElement.ts";

const BG = packRgb(7, 8, 9);
const TITLE_FG = packRgb(44, 55, 66);
const ACTION_FG = packRgb(200, 210, 220);

function action(overrides: Partial<PanelViewAction> & { commandId: string; run: () => void }): PanelViewAction {
    return { icon: "+", tooltip: overrides.commandId, ...overrides };
}

function makePanel(): PanelContainerElement {
    const panel = new PanelContainerElement();
    panel.background = BG;
    panel.titleForeground = TITLE_FG;
    panel.actionForeground = ACTION_FG;
    panel.addView({ id: "problems", title: "PROBLEMS", content: null });
    panel.addView({ id: "terminal", title: "TERMINAL", content: null });
    return panel;
}

function layout(panel: PanelContainerElement, size: Size): void {
    panel.globalPosition = new Point(0, 0);
    panel.performLayout(BoxConstraints.tight(size));
}

function render(panel: PanelContainerElement, size: Size): MockTerminalBackend {
    const backend = new MockTerminalBackend(size);
    const screen = new TerminalScreen(size);
    panel.render(new RenderContext(screen, new Offset(0, 0), new Rect(new Point(0, 0), size)));
    screen.flush(backend);
    return backend;
}

function mousedown(panel: PanelContainerElement, x: number, y = 1): void {
    panel.dispatchEvent(
        new TUIMouseEvent("mousedown", { button: "left", screenX: x, screenY: y, localX: x, localY: y }),
    );
}

describe("PanelContainerElement — header toolbar actions", () => {
    it("draws the active view's actions right-aligned on the tab row", () => {
        const panel = makePanel();
        panel.setActiveView("terminal");
        // width 40: two 1-wide glyphs + 1 gap + 1 right margin → "+" at 36, "K" at 38.
        panel.setViewActions("terminal", [
            action({ commandId: "new", icon: "+", run: () => {} }),
            action({ commandId: "kill", icon: "K", run: () => {} }),
        ]);
        layout(panel, new Size(40, 5));
        const backend = render(panel, new Size(40, 5));

        expect(backend.getTextAt(new Point(36, 1), 1)).toBe("+");
        expect(backend.getTextAt(new Point(38, 1), 1)).toBe("K");
        expect(backend.getFgAt(new Point(36, 1))).toBe(ACTION_FG);
    });

    it("only shows the active view's actions", () => {
        const panel = makePanel();
        panel.setActiveView("problems"); // problems has no actions
        panel.setViewActions("terminal", [action({ commandId: "new", icon: "+", run: () => {} })]);
        layout(panel, new Size(40, 5));
        const backend = render(panel, new Size(40, 5));
        expect(backend.getTextAt(new Point(38, 1), 1)).toBe(" ");
    });

    it("fires an action's run() on click and does not switch the tab", () => {
        const panel = makePanel();
        panel.setActiveView("terminal");
        let ran = 0;
        panel.setViewActions("terminal", [action({ commandId: "new", icon: "+", run: () => ran++ })]);
        layout(panel, new Size(40, 5));

        // Single action: total 1, start = 40 - 1 - 1 = 38.
        mousedown(panel, 38);
        expect(ran).toBe(1);
        expect(panel.getActiveViewId()).toBe("terminal"); // unchanged
    });

    it("ignores clicks on a disabled action", () => {
        const panel = makePanel();
        panel.setActiveView("terminal");
        let ran = 0;
        panel.setViewActions("terminal", [action({ commandId: "kill", icon: "K", enabled: false, run: () => ran++ })]);
        layout(panel, new Size(40, 5));

        const backend = render(panel, new Size(40, 5));
        // Disabled glyph renders dim (title colour), not the bright action colour.
        expect(backend.getFgAt(new Point(38, 1))).toBe(TITLE_FG);

        mousedown(panel, 38);
        expect(ran).toBe(0);
    });

    it("lets tab labels win an overlap on a narrow panel (toolbar dropped)", () => {
        const panel = makePanel();
        panel.setActiveView("terminal");
        let ran = 0;
        panel.setViewActions("terminal", [action({ commandId: "new", icon: "+", run: () => ran++ })]);
        // width 19: tabs occupy [1,19) (PROBLEMS+TERMINAL). Action would start at 17,
        // which is inside the tab region → dropped. A click there switches the tab.
        layout(panel, new Size(19, 5));
        const backend = render(panel, new Size(19, 5));

        expect(backend.getTextAt(new Point(17, 1), 1)).not.toBe("+"); // no toolbar glyph
        panel.setActiveView("problems"); // move away so the click's switch is observable
        mousedown(panel, 17); // inside the TERMINAL tab segment [11,19)
        expect(ran).toBe(0);
        expect(panel.getActiveViewId()).toBe("terminal");
    });

    it("ignores toolbar setup for an unknown view id", () => {
        const panel = makePanel();
        panel.setViewActions("nope", [action({ commandId: "x", run: () => {} })]);
        // No throw, and the terminal view still has no toolbar.
        panel.setActiveView("terminal");
        layout(panel, new Size(40, 5));
        const backend = render(panel, new Size(40, 5));
        expect(backend.getTextAt(new Point(38, 1), 1)).toBe(" ");
    });

    it("getViewActions returns [] for an unknown id or a view without actions", () => {
        const panel = makePanel();
        expect(panel.getViewActions("nope")).toEqual([]);
        expect(panel.getViewActions("terminal")).toEqual([]);
        const acts = [action({ commandId: "new", run: () => {} })];
        panel.setViewActions("terminal", acts);
        expect(panel.getViewActions("terminal")).toBe(acts);
    });

    it("renders a wide-grapheme action glyph, keeping its continuation cell as background", () => {
        const panel = makePanel();
        panel.setActiveView("terminal");
        // A 2-wide glyph (CJK): total 2, start = 40 - 1 - 2 = 37; cell 38 is the continuation.
        panel.setViewActions("terminal", [action({ commandId: "kill", icon: "日", run: () => {} })]);
        layout(panel, new Size(40, 5));
        const backend = render(panel, new Size(40, 5));
        expect(backend.getTextAt(new Point(37, 1), 1)).toBe("日");
        expect(backend.getFgAt(new Point(37, 1))).toBe(ACTION_FG);
        expect(backend.getBgAt(new Point(38, 1))).toBe(BG); // continuation cell stays background
    });
});
