import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Offset, Point, Rect, Size } from "../../../Common/GeometryPromitives.ts";
import { packRgb } from "../../../Rendering/ColorUtils.ts";
import { TerminalScreen } from "../../../Rendering/TerminalScreen.ts";
import { TUIMouseEvent } from "../../Events/TUIMouseEvent.ts";
import { RenderContext } from "../../TUIElement.ts";

import { TerminalListElement } from "./TerminalListElement.ts";

const BG = packRgb(1, 2, 3);
const FG = packRgb(140, 140, 140);
const ACTIVE_BG = packRgb(4, 57, 94);
const ACTIVE_FG = packRgb(255, 255, 255);
const HOVER_BG = packRgb(42, 45, 46);

const WIDTH = 20;
const HEIGHT = 5;
// closeCol = width - RIGHT_PAD(1) - CLOSE(1) = 18.
const CLOSE_COL = 18;

function makeList(): TerminalListElement {
    const list = new TerminalListElement();
    list.background = BG;
    list.foreground = FG;
    list.activeSelectionBg = ACTIVE_BG;
    list.activeSelectionFg = ACTIVE_FG;
    list.hoverBg = HOVER_BG;
    list.performLayout(BoxConstraints.tight(new Size(WIDTH, HEIGHT)));
    return list;
}

function render(list: TerminalListElement): MockTerminalBackend {
    const size = new Size(WIDTH, HEIGHT);
    const backend = new MockTerminalBackend(size);
    const screen = new TerminalScreen(size);
    list.render(new RenderContext(screen, new Offset(0, 0), new Rect(new Point(0, 0), size)));
    screen.flush(backend);
    return backend;
}

function click(list: TerminalListElement, localX: number, localY: number, button: "left" | "middle" = "left"): void {
    list.dispatchEvent(new TUIMouseEvent("click", { button, screenX: localX, screenY: localY, localX, localY }));
}

function move(list: TerminalListElement, localY: number): void {
    list.dispatchEvent(new TUIMouseEvent("mousemove", { button: "left", screenX: 0, screenY: localY, localX: 0, localY }));
}

describe("TerminalListElement", () => {
    it("renders one row per terminal and highlights the active one", () => {
        const list = makeList();
        list.setItems([{ id: 1, title: "bash (1)" }, { id: 2, title: "zsh (2)" }], 2);
        const backend = render(list);

        expect(backend.getTextAt(new Point(1, 0), 8)).toBe("bash (1)");
        expect(backend.getTextAt(new Point(1, 1), 7)).toBe("zsh (2)");
        // Active row (index 1) painted with the selection background + foreground.
        expect(backend.getBgAt(new Point(1, 1))).toBe(ACTIVE_BG);
        expect(backend.getFgAt(new Point(1, 1))).toBe(ACTIVE_FG);
        // Inactive row keeps the plain list background.
        expect(backend.getBgAt(new Point(1, 0))).toBe(BG);
        // The active row shows its × affordance.
        expect(backend.getTextAt(new Point(CLOSE_COL, 1), 1)).toBe("×");
    });

    it("switches on a row-body click and kills on the × cell", () => {
        const list = makeList();
        list.setItems([{ id: 7, title: "one" }, { id: 8, title: "two" }], 7);
        const activated: number[] = [];
        const closed: number[] = [];
        list.onActivate = (id) => activated.push(id);
        list.onClose = (id) => closed.push(id);

        click(list, 2, 1); // body of row 1 → activate id 8
        click(list, CLOSE_COL, 0); // × of row 0 → close id 7
        expect(activated).toEqual([8]);
        expect(closed).toEqual([7]);
    });

    it("middle-clicks a row to kill it", () => {
        const list = makeList();
        list.setItems([{ id: 5, title: "x" }], 5);
        const closed: number[] = [];
        list.onClose = (id) => closed.push(id);
        click(list, 2, 0, "middle");
        expect(closed).toEqual([5]);
    });

    it("ignores clicks below the last row", () => {
        const list = makeList();
        list.setItems([{ id: 1, title: "a" }], 1);
        let hits = 0;
        list.onActivate = () => hits++;
        list.onClose = () => hits++;
        click(list, 2, 3); // no row there
        expect(hits).toBe(0);
    });

    it("shows the × on a hovered row and clears it on leave", () => {
        const list = makeList();
        list.setItems([{ id: 1, title: "a" }, { id: 2, title: "b" }], 1);

        move(list, 1); // hover the inactive row 1
        expect(render(list).getTextAt(new Point(CLOSE_COL, 1), 1)).toBe("×");
        expect(render(list).getBgAt(new Point(1, 1))).toBe(HOVER_BG);

        list.dispatchEvent(new TUIMouseEvent("mouseleave", { button: "left", screenX: 0, screenY: 0, localX: 0, localY: 0 }));
        expect(render(list).getTextAt(new Point(CLOSE_COL, 1), 1)).toBe(" ");
    });

    it("ignores a right-click on a row", () => {
        const list = makeList();
        list.setItems([{ id: 1, title: "a" }], 1);
        let hits = 0;
        list.onActivate = () => hits++;
        list.onClose = () => hits++;
        list.dispatchEvent(
            new TUIMouseEvent("click", { button: "right", screenX: 2, screenY: 0, localX: 2, localY: 0 }),
        );
        expect(hits).toBe(0);
    });

    it("tracks the hovered row: same row is a no-op, off-list clears it", () => {
        const list = makeList();
        list.setItems([{ id: 1, title: "a" }, { id: 2, title: "b" }], 1);

        move(list, 1);
        move(list, 1); // same row → early return, still hovered
        expect(render(list).getTextAt(new Point(CLOSE_COL, 1), 1)).toBe("×");

        move(list, 4); // below the last row → hover cleared
        expect(render(list).getTextAt(new Point(CLOSE_COL, 1), 1)).toBe(" ");
    });

    it("mouseleave is inert when nothing is hovered", () => {
        const list = makeList();
        list.setItems([{ id: 1, title: "a" }], 0);
        expect(() =>
            list.dispatchEvent(
                new TUIMouseEvent("mouseleave", { button: "left", screenX: 0, screenY: 0, localX: 0, localY: 0 }),
            ),
        ).not.toThrow();
    });

    it("truncates a long title at the × column and handles wide graphemes", () => {
        const list = makeList();
        // Ten CJK glyphs (width 2 each): fills past the × column, exercising the
        // truncation break and the wide-grapheme continuation skip.
        list.setItems([{ id: 1, title: "日本語日本語日本語日" }], 1);
        const backend = render(list);
        expect(backend.getTextAt(new Point(1, 0), 1)).toBe("日");
        // Nothing spills into the × column region.
        expect(backend.getTextAt(new Point(CLOSE_COL, 0), 1)).toBe("×");
    });

    it("drops a stale hover when the item under it disappears", () => {
        const list = makeList();
        list.setItems([{ id: 1, title: "a" }, { id: 2, title: "b" }], 2);
        move(list, 1); // hover the (active) row 1
        list.setItems([{ id: 1, title: "a" }], 0); // row 1 gone, no active row
        // The surviving row 0 is neither hovered nor active → no ×.
        expect(render(list).getTextAt(new Point(CLOSE_COL, 0), 1)).toBe(" ");
    });
});
