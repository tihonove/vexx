import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Offset, Point, Size } from "../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../Rendering/TerminalScreen.ts";

import { CompositeElement } from "./CompositeElement.ts";
import type { ComponentType, JsxNode } from "./JSX/jsx-runtime.ts";
import { jsx } from "./JSX/jsx-runtime.ts";
import { RenderContext, TUIElement } from "./TUIElement.ts";

// A leaf with fixed intrinsic sizes that draws a single marker char and records
// the constraints / global position it was laid out with.
class MarkerLeaf extends TUIElement {
    public laidOutWith: BoxConstraints | null = null;

    public override getMinIntrinsicWidth(): number {
        return 4;
    }
    public override getMaxIntrinsicWidth(): number {
        return 7;
    }
    public override getMinIntrinsicHeight(): number {
        return 2;
    }
    public override getMaxIntrinsicHeight(): number {
        return 3;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        this.laidOutWith = constraints;
        return super.performLayout(constraints);
    }

    public override render(context: RenderContext): void {
        context.setCell(0, 0, { char: "M" });
    }
}

const MarkerComponent: ComponentType<object> = (): MarkerLeaf => new MarkerLeaf();

class MarkerComposite extends CompositeElement {
    protected override describe(): JsxNode {
        return jsx(MarkerComponent, {});
    }
}

describe("CompositeElement proxy behavior (lines 72-84)", () => {
    it("proxies all four intrinsic-size queries to the built child", () => {
        const comp = new MarkerComposite();
        comp.rebuild();

        expect(comp.getMinIntrinsicWidth(0)).toBe(4);
        expect(comp.getMaxIntrinsicWidth(0)).toBe(7);
        expect(comp.getMinIntrinsicHeight(0)).toBe(2);
        expect(comp.getMaxIntrinsicHeight(0)).toBe(3);
    });

    it("resets a previously non-zero child localPosition to (0,0) during layout", () => {
        const comp = new MarkerComposite();
        comp.rebuild();

        const child = comp.getRootChild()!;
        // Pretend the child was previously positioned elsewhere.
        child.localPosition = new Offset(9, 9);

        comp.globalPosition = new Point(5, 6);
        comp.performLayout(BoxConstraints.tight(new Size(30, 8)));

        // The proxy forces the child to the composite origin.
        expect(child.localPosition).toEqual(new Offset(0, 0));
        // And the child inherits the composite's global position.
        expect(child.globalPosition).toEqual(new Point(5, 6));
        // The child is laid out tightly to the composite's resolved size.
        const leaf = child as MarkerLeaf;
        expect(leaf.laidOutWith!.maxWidth).toBe(30);
        expect(leaf.laidOutWith!.maxHeight).toBe(8);
    });

    it("renders the child shifted by the child's localPosition offset", () => {
        const comp = new MarkerComposite();
        comp.rebuild();
        comp.globalPosition = new Point(0, 0);
        comp.performLayout(BoxConstraints.tight(new Size(10, 3)));

        // After layout the child localPosition is (0,0), so the marker lands at (0,0).
        const size = new Size(10, 3);
        const screen = new TerminalScreen(size);
        const backend = new MockTerminalBackend(size);
        comp.render(new RenderContext(screen));
        screen.flush(backend);

        expect(backend.getTextAt(new Point(0, 0), 1)).toBe("M");
    });
});
