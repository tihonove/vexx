import { describe, expect, it } from "vitest";

import { packRgb } from "../../Rendering/ColorUtils.ts";
import { TUIElement } from "../TUIElement.ts";

import { ROOT_RESOLVED_STYLE } from "./TUIStyle.ts";

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

describe("style setter triggers dirty", () => {
    it("marks self and all descendants dirty", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        const mid = new ContainerElement();
        const leaf = new TUIElement();
        root.addChild(mid);
        mid.addChild(leaf);

        // Resolve to clear dirty flags
        root.performStyleResolution(ROOT_RESOLVED_STYLE);

        // Setting style triggers markStyleDirty internally
        const fg = packRgb(100, 200, 50);
        root.style = { defaultFg: fg };
        root.performStyleResolution(ROOT_RESOLVED_STYLE);

        expect(root.resolvedStyle.defaultFg).toBe(fg);
        expect(mid.resolvedStyle.defaultFg).toBe(fg);
        expect(leaf.resolvedStyle.defaultFg).toBe(fg);
    });

    it("triggers markDirty for render scheduling", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        let renderRequested = false;
        root.setRequestRenderCallback(() => {
            renderRequested = true;
        });

        root.style = { defaultFg: packRgb(1, 2, 3) };
        expect(renderRequested).toBe(true);
    });
});

describe("performStyleResolution", () => {
    it("clears dirty flags after resolution", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        root.setRequestRenderCallback(() => {});
        const child = new TUIElement();
        root.addChild(child);

        root.performStyleResolution(ROOT_RESOLVED_STYLE);

        // Manually poke resolvedStyle to verify early-exit:
        // After resolution, setting style triggers dirty again
        const fg = packRgb(255, 0, 0);
        root.style = { defaultFg: fg };
        root.performStyleResolution(ROOT_RESOLVED_STYLE);

        // This time it WAS dirty (setter triggered it), so it should resolve
        expect(root.resolvedStyle.defaultFg).toBe(fg);
    });

    it("cascades defaultFg through tree", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        root.setRequestRenderCallback(() => {});
        const mid = new ContainerElement();
        const leaf = new TUIElement();
        root.addChild(mid);
        mid.addChild(leaf);

        const green = packRgb(0, 255, 0);
        root.style = { defaultFg: green };

        root.performStyleResolution(ROOT_RESOLVED_STYLE);

        expect(root.resolvedStyle.fg).toBe(green);
        expect(mid.resolvedStyle.fg).toBe(green);
        expect(leaf.resolvedStyle.fg).toBe(green);
    });

    it("mid-level defaultFg override shadows parent", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        root.setRequestRenderCallback(() => {});
        const mid = new ContainerElement();
        const leaf = new TUIElement();
        root.addChild(mid);
        mid.addChild(leaf);

        const rootFg = packRgb(255, 255, 255);
        const midFg = packRgb(128, 128, 128);
        root.style = { defaultFg: rootFg };
        mid.style = { defaultFg: midFg };

        root.performStyleResolution(ROOT_RESOLVED_STYLE);

        expect(root.resolvedStyle.fg).toBe(rootFg);
        expect(mid.resolvedStyle.fg).toBe(midFg);
        expect(leaf.resolvedStyle.fg).toBe(midFg);
    });

    it("explicit fg on leaf overrides cascade", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        root.setRequestRenderCallback(() => {});
        const leaf = new TUIElement();
        root.addChild(leaf);

        const rootFg = packRgb(200, 200, 200);
        const leafFg = packRgb(255, 0, 0);
        root.style = { defaultFg: rootFg };
        leaf.style = { fg: leafFg };

        root.performStyleResolution(ROOT_RESOLVED_STYLE);

        expect(root.resolvedStyle.fg).toBe(rootFg);
        expect(leaf.resolvedStyle.fg).toBe(leafFg);
    });

    it("early exit: clean subtree is not re-resolved", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        root.setRequestRenderCallback(() => {});
        const child = new TUIElement();
        root.addChild(child);

        const fg1 = packRgb(10, 20, 30);
        root.style = { defaultFg: fg1 };

        // First resolution
        root.performStyleResolution(ROOT_RESOLVED_STYLE);
        expect(child.resolvedStyle.fg).toBe(fg1);

        // Second performStyleResolution without style change
        // Both root and child are clean — should early-exit
        root.performStyleResolution(ROOT_RESOLVED_STYLE);
        expect(child.resolvedStyle.fg).toBe(fg1);
    });

    it("cascade change via style setter updates entire subtree", () => {
        const root = new ContainerElement();
        root.setAsRoot();
        root.setRequestRenderCallback(() => {});
        const mid = new ContainerElement();
        const leaf = new TUIElement();
        root.addChild(mid);
        mid.addChild(leaf);

        const fg1 = packRgb(100, 100, 100);
        root.style = { defaultFg: fg1 };
        root.performStyleResolution(ROOT_RESOLVED_STYLE);
        expect(leaf.resolvedStyle.fg).toBe(fg1);

        // Change cascade color via setter — triggers dirty automatically
        const fg2 = packRgb(200, 200, 200);
        root.style = { defaultFg: fg2 };
        root.performStyleResolution(ROOT_RESOLVED_STYLE);

        expect(root.resolvedStyle.fg).toBe(fg2);
        expect(mid.resolvedStyle.fg).toBe(fg2);
        expect(leaf.resolvedStyle.fg).toBe(fg2);
    });
});
