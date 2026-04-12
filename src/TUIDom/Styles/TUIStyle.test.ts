import { describe, expect, it } from "vitest";

import { DEFAULT_COLOR, packRgb } from "../../Rendering/ColorUtils.ts";

import type { ResolvedTUIStyle } from "./TUIStyle.ts";
import { INHERITED_BG, INHERITED_FG, resolveStyle, resolveStyleColor, ROOT_RESOLVED_STYLE } from "./TUIStyle.ts";

describe("resolveStyleColor", () => {
    const ifg = packRgb(200, 200, 200);
    const ibg = packRgb(30, 30, 30);

    it("resolves INHERITED_FG to inherited fg", () => {
        expect(resolveStyleColor(INHERITED_FG, ifg, ibg)).toBe(ifg);
    });

    it("resolves INHERITED_BG to inherited bg", () => {
        expect(resolveStyleColor(INHERITED_BG, ifg, ibg)).toBe(ibg);
    });

    it("passes through concrete RGB unchanged", () => {
        const red = packRgb(255, 0, 0);
        expect(resolveStyleColor(red, ifg, ibg)).toBe(red);
    });

    it("passes through DEFAULT_COLOR unchanged", () => {
        expect(resolveStyleColor(DEFAULT_COLOR, ifg, ibg)).toBe(DEFAULT_COLOR);
    });
});

describe("resolveStyle", () => {
    const parentFg = packRgb(200, 200, 200);
    const parentBg = packRgb(30, 30, 30);

    const inherited: ResolvedTUIStyle = {
        fg: parentFg,
        bg: parentBg,
    };

    it("empty style inherits fg/bg from parent", () => {
        const result = resolveStyle({}, inherited);
        expect(result.fg).toBe(parentFg);
        expect(result.bg).toBe(parentBg);
    });

    it("explicit fg overrides inherited", () => {
        const red = packRgb(255, 0, 0);
        const result = resolveStyle({ fg: red }, inherited);
        expect(result.fg).toBe(red);
        expect(result.bg).toBe(parentBg);
    });

    it("explicit bg overrides inherited", () => {
        const blue = packRgb(0, 0, 255);
        const result = resolveStyle({ bg: blue }, inherited);
        expect(result.fg).toBe(parentFg);
        expect(result.bg).toBe(blue);
    });

    it("INHERITED_FG resolves to parent fg", () => {
        const result = resolveStyle({ fg: INHERITED_FG }, inherited);
        expect(result.fg).toBe(parentFg);
    });

    it("INHERITED_BG resolves to parent bg", () => {
        const result = resolveStyle({ bg: INHERITED_BG }, inherited);
        expect(result.bg).toBe(parentBg);
    });

    it("explicit fg + bg both override", () => {
        const red = packRgb(255, 0, 0);
        const blue = packRgb(0, 0, 255);
        const result = resolveStyle({ fg: red, bg: blue }, inherited);
        expect(result.fg).toBe(red);
        expect(result.bg).toBe(blue);
    });

    it("3-level cascade: root → mid → leaf", () => {
        const rootFg = packRgb(255, 255, 255);
        const rootBg = packRgb(0, 0, 0);

        const rootResolved = resolveStyle({ fg: rootFg, bg: rootBg }, ROOT_RESOLVED_STYLE);
        expect(rootResolved.fg).toBe(rootFg);

        const midResolved = resolveStyle({}, rootResolved);
        expect(midResolved.fg).toBe(rootFg);

        const leafResolved = resolveStyle({}, midResolved);
        expect(leafResolved.fg).toBe(rootFg);
        expect(leafResolved.bg).toBe(rootBg);
    });

    it("mid-level override: root → mid(new fg) → leaf", () => {
        const rootFg = packRgb(255, 255, 255);
        const midFg = packRgb(128, 128, 128);

        const rootResolved = resolveStyle({ fg: rootFg }, ROOT_RESOLVED_STYLE);
        const midResolved = resolveStyle({ fg: midFg }, rootResolved);
        const leafResolved = resolveStyle({}, midResolved);

        expect(leafResolved.fg).toBe(midFg);
    });
});
