import { describe, expect, it } from "vitest";

import { packRgb } from "../Rendering/ColorUtils.ts";

import { CompositeElement } from "./CompositeElement.ts";
import type { JsxNode } from "./JSX/jsx-runtime.ts";
import { ROOT_RESOLVED_STYLE } from "./Styles/TUIStyle.ts";
import { TUIElement } from "./TUIElement.ts";
import { TextLabel } from "./Widgets/TextLabelElement.ts";

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

class TestComposite extends CompositeElement {
    public color = packRgb(100, 100, 100);

    public constructor() {
        super();
        this.rebuild();
    }

    public describe(): JsxNode {
        return TextLabel({ text: "test", fg: this.color, bg: this.color });
    }
}

describe("CompositeElement style resolution", () => {
    it("rebuild with new colors resolves correctly after style resolution", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        root.setRequestRenderCallback(() => {});
        const composite = new TestComposite();
        root.addChild(composite);

        root.performStyleResolution(ROOT_RESOLVED_STYLE);
        expect(composite.getRootChild()!.resolvedStyle.fg).toBe(packRgb(100, 100, 100));

        composite.color = packRgb(255, 0, 0);
        composite.rebuild();
        root.performStyleResolution(ROOT_RESOLVED_STYLE);
        expect(composite.getRootChild()!.resolvedStyle.fg).toBe(packRgb(255, 0, 0));
    });

    it("newly attached composite resolves child styles", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        root.setRequestRenderCallback(() => {});
        root.performStyleResolution(ROOT_RESOLVED_STYLE);

        const composite = new TestComposite();
        composite.color = packRgb(0, 90, 180);
        composite.rebuild();

        root.addChild(composite);
        root.performStyleResolution(ROOT_RESOLVED_STYLE);
        const child = composite.getRootChild()!;
        expect(child.resolvedStyle.fg).toBe(packRgb(0, 90, 180));
    });
});
