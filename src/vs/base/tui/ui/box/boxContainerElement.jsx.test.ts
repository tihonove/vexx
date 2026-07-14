import { describe, expect, it } from "vitest";

import { Point } from "../../../common/geometry.ts";
import { packRgb } from "../../../common/color.ts";
import { renderElement } from "../../../../../TestUtils/renderElement.ts";

import { BoxContainer, BoxContainerElement } from "./boxContainerElement.ts";
import { BoxElement } from "./boxElement.ts";

describe("BoxContainer JSX adapter", () => {
    it("applies every prop to the created element and adopts the child", () => {
        const BG = packRgb(1, 2, 3);
        const BORDER = packRgb(10, 20, 30);
        const TITLE_FG = packRgb(40, 50, 60);

        const child = new BoxElement();
        const el = BoxContainer({
            bg: BG,
            fg: packRgb(7, 7, 7),
            borderFg: BORDER,
            title: "Hi",
            titleFg: TITLE_FG,
            hasSeparator: true,
            children: child,
        });

        expect(el).toBeInstanceOf(BoxContainerElement);
        expect(el.getChildren()).toEqual([child]);

        const backend = renderElement(el, 8, 6);

        // Border corner uses borderFg over the configured background.
        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("╭");
        expect(backend.getFgAt(new Point(0, 0))).toBe(BORDER);
        expect(backend.getBgAt(new Point(0, 0))).toBe(BG);

        // Title centred on row 1 with titleFg ("Hi" → floor((8-2)/2) = 3).
        expect(backend.getTextAt(new Point(3, 1), 2)).toBe("Hi");
        expect(backend.getFgAt(new Point(3, 1))).toBe(TITLE_FG);

        // hasSeparator draws the divider row.
        expect(backend.getTextAt(new Point(0, 2), 8)).toBe("├──────┤");
    });

    it("creates a childless box when no children are provided", () => {
        const el = BoxContainer({ title: "X" });
        expect(el.getChildren()).toEqual([]);
    });

    it("update() reapplies props and swaps the child, detaching the old one", () => {
        const first = new BoxElement();
        const el = BoxContainer({ title: "A", children: first });
        expect(el.getChildren()).toEqual([first]);
        expect(first.getParent()).toBe(el);

        const second = new BoxElement();
        BoxContainer.update(el, { title: "B", borderFg: packRgb(9, 9, 9), children: second });

        expect(el.getChildren()).toEqual([second]);
        expect(first.getParent()).toBeNull();
        expect(second.getParent()).toBe(el);
    });

    it("update() clears the child when none are provided", () => {
        const el = BoxContainer({ title: "A", children: new BoxElement() });
        BoxContainer.update(el, { title: "B" });
        expect(el.getChildren()).toEqual([]);
    });

    it("creates a childless box when children is present but normalizes to nothing", () => {
        // `children: false` is defined (so the children branch runs) yet reconciles
        // to an empty array → `children[0] ?? null` falls back to null.
        const el = BoxContainer({ title: "X", children: false });
        expect(el.getChildren()).toEqual([]);
    });
});
