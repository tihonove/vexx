import { describe, expect, it } from "vitest";

import { BoxConstraints, Point, Size } from "../Common/GeometryPromitives.ts";

import { TUIElement } from "./TUIElement.ts";

// ─── Helpers ───

class ContainerElement extends TUIElement {
    private children: TUIElement[] = [];

    public addChild(child: TUIElement): void {
        child.setParent(this);
        this.children.push(child);
    }

    public override getChildren(): readonly TUIElement[] {
        return this.children;
    }
}

function layoutElement(el: TUIElement, globalPos: Point, size: Size): void {
    el.globalPosition = globalPos;
    el.performLayout(BoxConstraints.tight(size));
}

// ─── Tests ───

describe("elementFromPoint — single element", () => {
    it("returns element when point is inside", () => {
        const el = new TUIElement();
        layoutElement(el, new Point(0, 0), new Size(80, 24));

        expect(el.elementFromPoint(new Point(10, 5))).toBe(el);
    });

    it("returns element at top-left boundary (inclusive)", () => {
        const el = new TUIElement();
        layoutElement(el, new Point(5, 3), new Size(20, 10));

        expect(el.elementFromPoint(new Point(5, 3))).toBe(el);
    });

    it("returns null at right boundary (exclusive)", () => {
        const el = new TUIElement();
        layoutElement(el, new Point(5, 3), new Size(20, 10));

        // right = 5 + 20 = 25
        expect(el.elementFromPoint(new Point(25, 5))).toBeNull();
    });

    it("returns null at bottom boundary (exclusive)", () => {
        const el = new TUIElement();
        layoutElement(el, new Point(5, 3), new Size(20, 10));

        // bottom = 3 + 10 = 13
        expect(el.elementFromPoint(new Point(10, 13))).toBeNull();
    });

    it("returns null when point is outside", () => {
        const el = new TUIElement();
        layoutElement(el, new Point(10, 10), new Size(5, 5));

        expect(el.elementFromPoint(new Point(0, 0))).toBeNull();
    });

    it("returns null for element with zero size", () => {
        const el = new TUIElement();
        layoutElement(el, new Point(10, 10), new Size(0, 0));

        expect(el.elementFromPoint(new Point(10, 10))).toBeNull();
    });
});

describe("elementFromPoint — flat structure (root → children)", () => {
    it("returns correct child in side-by-side layout", () => {
        const root = new ContainerElement();
        layoutElement(root, new Point(0, 0), new Size(80, 24));

        const child1 = new TUIElement();
        layoutElement(child1, new Point(0, 0), new Size(40, 24));
        root.addChild(child1);

        const child2 = new TUIElement();
        layoutElement(child2, new Point(40, 0), new Size(40, 24));
        root.addChild(child2);

        expect(root.elementFromPoint(new Point(10, 5))).toBe(child1);
        expect(root.elementFromPoint(new Point(50, 5))).toBe(child2);
    });

    it("returns root when point is outside all children but inside root", () => {
        const root = new ContainerElement();
        layoutElement(root, new Point(0, 0), new Size(80, 24));

        const child = new TUIElement();
        layoutElement(child, new Point(10, 10), new Size(20, 10));
        root.addChild(child);

        expect(root.elementFromPoint(new Point(5, 5))).toBe(root);
    });

    it("returns last child when overlapping (z-order: last = topmost)", () => {
        const root = new ContainerElement();
        layoutElement(root, new Point(0, 0), new Size(80, 24));

        const child1 = new TUIElement();
        layoutElement(child1, new Point(0, 0), new Size(20, 10));
        root.addChild(child1);

        const child2 = new TUIElement();
        layoutElement(child2, new Point(5, 5), new Size(20, 10));
        root.addChild(child2);

        // Point (10, 7) is inside both children; child2 should win
        expect(root.elementFromPoint(new Point(10, 7))).toBe(child2);
    });

    it("returns first child when point only hits first", () => {
        const root = new ContainerElement();
        layoutElement(root, new Point(0, 0), new Size(80, 24));

        const child1 = new TUIElement();
        layoutElement(child1, new Point(0, 0), new Size(20, 10));
        root.addChild(child1);

        const child2 = new TUIElement();
        layoutElement(child2, new Point(30, 0), new Size(20, 10));
        root.addChild(child2);

        expect(root.elementFromPoint(new Point(5, 5))).toBe(child1);
    });
});

describe("elementFromPoint — deep nesting", () => {
    it("finds leaf in deeply nested tree", () => {
        const root = new ContainerElement();
        layoutElement(root, new Point(0, 0), new Size(80, 24));

        const container = new ContainerElement();
        layoutElement(container, new Point(5, 2), new Size(70, 20));
        root.addChild(container);

        const inner = new ContainerElement();
        layoutElement(inner, new Point(10, 5), new Size(50, 10));
        container.addChild(inner);

        const leaf = new TUIElement();
        layoutElement(leaf, new Point(15, 7), new Size(30, 5));
        inner.addChild(leaf);

        expect(root.elementFromPoint(new Point(20, 9))).toBe(leaf);
    });

    it("returns container when point is outside inner but inside container", () => {
        const root = new ContainerElement();
        layoutElement(root, new Point(0, 0), new Size(80, 24));

        const container = new ContainerElement();
        layoutElement(container, new Point(5, 2), new Size(70, 20));
        root.addChild(container);

        const inner = new TUIElement();
        layoutElement(inner, new Point(10, 5), new Size(50, 10));
        container.addChild(inner);

        // Point (7, 3) is inside container but outside inner
        expect(root.elementFromPoint(new Point(7, 3))).toBe(container);
    });

    it("returns root when point is outside container", () => {
        const root = new ContainerElement();
        layoutElement(root, new Point(0, 0), new Size(80, 24));

        const container = new ContainerElement();
        layoutElement(container, new Point(5, 2), new Size(70, 20));
        root.addChild(container);

        // Point (2, 1) is inside root but outside container
        expect(root.elementFromPoint(new Point(2, 1))).toBe(root);
    });
});

describe("elementFromPoint — multiple containers (horizontal split)", () => {
    it("finds correct item across panels", () => {
        const root = new ContainerElement();
        layoutElement(root, new Point(0, 0), new Size(80, 24));

        const panelA = new ContainerElement();
        layoutElement(panelA, new Point(0, 0), new Size(40, 24));
        root.addChild(panelA);

        const itemA1 = new TUIElement();
        layoutElement(itemA1, new Point(0, 0), new Size(40, 12));
        panelA.addChild(itemA1);

        const itemA2 = new TUIElement();
        layoutElement(itemA2, new Point(0, 12), new Size(40, 12));
        panelA.addChild(itemA2);

        const panelB = new ContainerElement();
        layoutElement(panelB, new Point(40, 0), new Size(40, 24));
        root.addChild(panelB);

        const itemB1 = new TUIElement();
        layoutElement(itemB1, new Point(40, 5), new Size(30, 10));
        panelB.addChild(itemB1);

        // Point inside itemA2
        expect(root.elementFromPoint(new Point(20, 15))).toBe(itemA2);
        // Point inside itemB1
        expect(root.elementFromPoint(new Point(50, 10))).toBe(itemB1);
        // Point inside panelB but outside itemB1
        expect(root.elementFromPoint(new Point(45, 2))).toBe(panelB);
    });
});

describe("elementFromPoint — nested containers with offsets", () => {
    it("correctly resolves through offset hierarchy", () => {
        const root = new ContainerElement();
        layoutElement(root, new Point(0, 0), new Size(80, 24));

        const panel = new ContainerElement();
        layoutElement(panel, new Point(5, 3), new Size(70, 18));
        root.addChild(panel);

        const widget = new TUIElement();
        layoutElement(widget, new Point(10, 5), new Size(50, 10));
        panel.addChild(widget);

        // Inside widget
        expect(root.elementFromPoint(new Point(15, 10))).toBe(widget);
        // Inside panel but outside widget
        expect(root.elementFromPoint(new Point(6, 4))).toBe(panel);
        // Inside root but outside panel
        expect(root.elementFromPoint(new Point(2, 1))).toBe(root);
    });
});

describe("elementFromPoint — edge cases", () => {
    it("empty container returns itself", () => {
        const container = new ContainerElement();
        layoutElement(container, new Point(0, 0), new Size(40, 20));

        expect(container.elementFromPoint(new Point(10, 10))).toBe(container);
    });

    it("returns null for point outside root", () => {
        const root = new ContainerElement();
        layoutElement(root, new Point(10, 10), new Size(20, 10));

        expect(root.elementFromPoint(new Point(5, 5))).toBeNull();
    });

    it("three levels of containers with single leaf", () => {
        const root = new ContainerElement();
        layoutElement(root, new Point(0, 0), new Size(100, 50));

        const level1 = new ContainerElement();
        layoutElement(level1, new Point(10, 10), new Size(80, 30));
        root.addChild(level1);

        const level2 = new ContainerElement();
        layoutElement(level2, new Point(20, 15), new Size(60, 20));
        level1.addChild(level2);

        const leaf = new TUIElement();
        layoutElement(leaf, new Point(30, 20), new Size(40, 10));
        level2.addChild(leaf);

        expect(root.elementFromPoint(new Point(35, 25))).toBe(leaf);
        expect(root.elementFromPoint(new Point(25, 17))).toBe(level2);
        expect(root.elementFromPoint(new Point(15, 12))).toBe(level1);
        expect(root.elementFromPoint(new Point(5, 5))).toBe(root);
    });

    it("many siblings — finds correct one", () => {
        const root = new ContainerElement();
        layoutElement(root, new Point(0, 0), new Size(100, 10));

        const children: TUIElement[] = [];
        for (let i = 0; i < 10; i++) {
            const child = new TUIElement();
            layoutElement(child, new Point(i * 10, 0), new Size(10, 10));
            root.addChild(child);
            children.push(child);
        }

        expect(root.elementFromPoint(new Point(5, 5))).toBe(children[0]);
        expect(root.elementFromPoint(new Point(55, 5))).toBe(children[5]);
        expect(root.elementFromPoint(new Point(95, 5))).toBe(children[9]);
    });
});
