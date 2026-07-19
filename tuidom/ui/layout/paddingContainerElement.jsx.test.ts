import { describe, expect, it } from "vitest";

import { packRgb } from "../../common/colorUtils.ts";

import { BoxElement } from "./boxElement.ts";
import { PaddingContainer, PaddingContainerElement } from "./paddingContainerElement.ts";

describe("PaddingContainerElement.setChild", () => {
    it("attaches the new child and detaches the previous one", () => {
        const first = new BoxElement();
        const padded = new PaddingContainerElement(first);
        expect(padded.getChildren()).toEqual([first]);
        expect(first.getParent()).toBe(padded);

        const second = new BoxElement();
        padded.setChild(second);
        expect(padded.getChildren()).toEqual([second]);
        expect(first.getParent()).toBeNull();
        expect(second.getParent()).toBe(padded);

        padded.setChild(null);
        expect(padded.getChildren()).toEqual([]);
    });
});

describe("PaddingContainer JSX adapter", () => {
    it("builds an element with padding, style, and child", () => {
        const BG = packRgb(11, 22, 33);
        const FG = packRgb(44, 55, 66);

        const child = new BoxElement();
        const el = PaddingContainer({ top: 1, right: 2, bottom: 3, left: 4, bg: BG, fg: FG, children: child });

        expect(el).toBeInstanceOf(PaddingContainerElement);
        expect(el.getPaddingTop()).toBe(1);
        expect(el.getPaddingRight()).toBe(2);
        expect(el.getPaddingBottom()).toBe(3);
        expect(el.getPaddingLeft()).toBe(4);
        expect(el.getChildren()).toEqual([child]);
        expect(el.style.bg).toBe(BG);
        expect(el.style.fg).toBe(FG);
    });

    it("leaves style untouched when neither bg nor fg is given", () => {
        const el = PaddingContainer({ top: 2 });
        expect(el.getPaddingTop()).toBe(2);
        expect(el.getChildren()).toEqual([]);
        expect(el.style.bg).toBeUndefined();
    });

    it("update() mutates padding and style and replaces the child", () => {
        const BG = packRgb(9, 8, 7);
        const first = new BoxElement();
        const el = PaddingContainer({ top: 1, children: first });

        const second = new BoxElement();
        PaddingContainer.update(el, { top: 5, right: 6, bottom: 7, left: 8, bg: BG, children: second });

        expect(el.getPaddingTop()).toBe(5);
        expect(el.getPaddingRight()).toBe(6);
        expect(el.getPaddingBottom()).toBe(7);
        expect(el.getPaddingLeft()).toBe(8);
        expect(el.style.bg).toBe(BG);
        expect(el.getChildren()).toEqual([second]);
        expect(first.getParent()).toBeNull();
    });

    it("update() resets padding to zero and clears the child when props are empty", () => {
        const el = PaddingContainer({ top: 3, left: 3, children: new BoxElement() });
        PaddingContainer.update(el, {});

        expect(el.getPaddingTop()).toBe(0);
        expect(el.getPaddingRight()).toBe(0);
        expect(el.getPaddingBottom()).toBe(0);
        expect(el.getPaddingLeft()).toBe(0);
        expect(el.getChildren()).toEqual([]);
    });
});
