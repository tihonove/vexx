import { describe, expect, it, vi } from "vitest";

import { TUIElement } from "../TUIElement.ts";

import { BLUEPRINT_TYPE, isBlueprint, jsx, jsxs } from "./jsx-runtime.ts";

function DummyComponent(_props: { text: string }): TUIElement {
    return new TUIElement();
}

describe("jsx-runtime", () => {
    describe("jsx", () => {
        it("creates a Blueprint with correct type and props", () => {
            const bp = jsx(DummyComponent, { text: "hello" });

            expect(bp.$$typeof).toBe(BLUEPRINT_TYPE);
            expect(bp.type).toBe(DummyComponent);
            expect(bp.props).toEqual({ text: "hello" });
            expect(bp.key).toBeUndefined();
            expect(bp.layout).toBeUndefined();
            expect(bp.ref).toBeUndefined();
        });

        it("extracts key from third argument", () => {
            const bp = jsx(DummyComponent, { text: "hello" }, "mykey");

            expect(bp.key).toBe("mykey");
            expect(bp.props).toEqual({ text: "hello" });
        });

        it("extracts layout from props", () => {
            const layout = { width: "fill", height: 1 };
            const bp = jsx(DummyComponent, { text: "hello", layout });

            expect(bp.layout).toBe(layout);
            expect(bp.props).toEqual({ text: "hello" });
        });

        it("extracts ref from props", () => {
            const ref = vi.fn();
            const bp = jsx(DummyComponent, { text: "hello", ref });

            expect(bp.ref).toBe(ref);
            expect(bp.props).toEqual({ text: "hello" });
        });

        it("passes children through in props", () => {
            const child = jsx(DummyComponent, { text: "child" });
            const bp = jsx(DummyComponent, { text: "parent", children: child });

            expect(bp.props.children).toBe(child);
        });
    });

    describe("jsxs", () => {
        it("is the same function as jsx", () => {
            expect(jsxs).toBe(jsx);
        });
    });

    describe("isBlueprint", () => {
        it("returns true for a Blueprint", () => {
            const bp = jsx(DummyComponent, { text: "hello" });
            expect(isBlueprint(bp)).toBe(true);
        });

        it("returns false for a TUIElement", () => {
            expect(isBlueprint(new TUIElement())).toBe(false);
        });

        it("returns false for null", () => {
            expect(isBlueprint(null)).toBe(false);
        });

        it("returns false for plain object", () => {
            expect(isBlueprint({ type: "div" })).toBe(false);
        });
    });
});
