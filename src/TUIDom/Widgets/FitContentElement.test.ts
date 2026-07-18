import { describe, expect, it } from "vitest";

import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { renderElement } from "../../TestUtils/renderElement.ts";

import { FitContentElement } from "./FitContentElement.ts";
import type { TextLabelElement } from "./TextLabelElement.ts";
import { TextLabel } from "./TextLabelElement.ts";

function label(text: string): TextLabelElement {
    return TextLabel({ text });
}

describe("FitContentElement", () => {
    it("sizes itself to the child's intrinsic size under loose constraints", () => {
        const fit = new FitContentElement();
        fit.setChild(label("hello"));

        const size = fit.performLayout(BoxConstraints.loose(new Size(80, 24)));

        expect(size.width).toBe(5);
        expect(size.height).toBe(1);
    });

    it("clamps the intrinsic size to the incoming constraints", () => {
        const fit = new FitContentElement();
        fit.setChild(label("a very long line of text"));

        const size = fit.performLayout(BoxConstraints.loose(new Size(10, 24)));

        expect(size.width).toBe(10);
    });

    it("proxies intrinsic sizes of the child", () => {
        const fit = new FitContentElement();
        fit.setChild(label("hello"));

        expect(fit.getMaxIntrinsicWidth(1)).toBe(5);
        expect(fit.getMinIntrinsicWidth(1)).toBeGreaterThanOrEqual(0);
        expect(fit.getMaxIntrinsicHeight(5)).toBe(1);
        expect(fit.getMinIntrinsicHeight(5)).toBeGreaterThanOrEqual(0);
    });

    it("is empty without a child", () => {
        const fit = new FitContentElement();

        const size = fit.performLayout(BoxConstraints.loose(new Size(80, 24)));

        expect(size.width).toBe(0);
        expect(size.height).toBe(0);
        expect(fit.getChildren().length).toBe(0);
        expect(fit.getChild()).toBeNull();
    });

    it("renders the child's content", () => {
        const fit = new FitContentElement();
        fit.setChild(label("hi"));

        const backend = renderElement(fit, 10, 3, { constraints: BoxConstraints.loose(new Size(10, 3)) });

        expect(backend.getTextAt(new Point(0, 0), 2)).toBe("hi");
    });

    it("replacing the child detaches the previous one", () => {
        const fit = new FitContentElement();
        const first = label("first");
        fit.setChild(first);
        const firstElement = fit.getChild();

        fit.setChild(label("second"));

        expect(firstElement?.getParent() ?? null).toBeNull();
        expect(fit.getChildren().length).toBe(1);
    });
});
