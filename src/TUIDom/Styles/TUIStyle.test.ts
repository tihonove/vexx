import { describe, expect, it } from "vitest";

import { DEFAULT_COLOR, packRgb } from "../../Rendering/ColorUtils.ts";

import {
    META_DEFAULT_BG,
    META_DEFAULT_FG,
    resolveStyle,
    resolveStyleColor,
    ROOT_RESOLVED_STYLE,
} from "./TUIStyle.ts";
import type { ResolvedTUIStyle } from "./TUIStyle.ts";

describe("resolveStyleColor", () => {
    const dfg = packRgb(200, 200, 200);
    const dbg = packRgb(30, 30, 30);

    it("returns DEFAULT_COLOR for undefined", () => {
        expect(resolveStyleColor(undefined, dfg, dbg)).toBe(DEFAULT_COLOR);
    });

    it("resolves META_DEFAULT_FG to defaultFg", () => {
        expect(resolveStyleColor(META_DEFAULT_FG, dfg, dbg)).toBe(dfg);
    });

    it("resolves META_DEFAULT_BG to defaultBg", () => {
        expect(resolveStyleColor(META_DEFAULT_BG, dfg, dbg)).toBe(dbg);
    });

    it("passes through concrete RGB unchanged", () => {
        const red = packRgb(255, 0, 0);
        expect(resolveStyleColor(red, dfg, dbg)).toBe(red);
    });

    it("passes through DEFAULT_COLOR unchanged", () => {
        expect(resolveStyleColor(DEFAULT_COLOR, dfg, dbg)).toBe(DEFAULT_COLOR);
    });
});

describe("resolveStyle", () => {
    const parentFg = packRgb(200, 200, 200);
    const parentBg = packRgb(30, 30, 30);

    const inherited: ResolvedTUIStyle = {
        defaultFg: parentFg,
        defaultBg: parentBg,
        fg: parentFg,
        bg: parentBg,
    };

    it("empty style inherits defaultFg/defaultBg from parent", () => {
        const result = resolveStyle({}, inherited);
        expect(result.defaultFg).toBe(parentFg);
        expect(result.defaultBg).toBe(parentBg);
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

    it("META_DEFAULT_FG resolves to inherited defaultFg", () => {
        const result = resolveStyle({ fg: META_DEFAULT_FG }, inherited);
        expect(result.fg).toBe(parentFg);
    });

    it("META_DEFAULT_BG resolves to inherited defaultBg", () => {
        const result = resolveStyle({ bg: META_DEFAULT_BG }, inherited);
        expect(result.bg).toBe(parentBg);
    });

    it("setting defaultFg establishes new cascade token", () => {
        const newDefault = packRgb(100, 100, 100);
        const result = resolveStyle({ defaultFg: newDefault }, inherited);
        expect(result.defaultFg).toBe(newDefault);
        // fg inherits from the NEW defaultFg
        expect(result.fg).toBe(newDefault);
        // bg still from parent cascade
        expect(result.bg).toBe(parentBg);
    });

    it("setting defaultBg establishes new cascade token", () => {
        const newDefault = packRgb(50, 50, 50);
        const result = resolveStyle({ defaultBg: newDefault }, inherited);
        expect(result.defaultBg).toBe(newDefault);
        expect(result.bg).toBe(newDefault);
        expect(result.fg).toBe(parentFg);
    });

    it("explicit fg + defaultFg: fg takes priority over cascade", () => {
        const newDefault = packRgb(100, 100, 100);
        const red = packRgb(255, 0, 0);
        const result = resolveStyle({ defaultFg: newDefault, fg: red }, inherited);
        expect(result.defaultFg).toBe(newDefault);
        expect(result.fg).toBe(red);
    });

    it("META_DEFAULT_FG uses newly defined defaultFg from same element", () => {
        const newDefault = packRgb(150, 150, 150);
        const result = resolveStyle({ defaultFg: newDefault, fg: META_DEFAULT_FG }, inherited);
        expect(result.fg).toBe(newDefault);
    });

    it("3-level cascade: root → mid → leaf", () => {
        const rootFg = packRgb(255, 255, 255);
        const rootBg = packRgb(0, 0, 0);

        // Root sets default colors
        const rootResolved = resolveStyle(
            { defaultFg: rootFg, defaultBg: rootBg },
            ROOT_RESOLVED_STYLE,
        );
        expect(rootResolved.defaultFg).toBe(rootFg);
        expect(rootResolved.fg).toBe(rootFg);

        // Mid element doesn't override anything
        const midResolved = resolveStyle({}, rootResolved);
        expect(midResolved.defaultFg).toBe(rootFg);
        expect(midResolved.fg).toBe(rootFg);

        // Leaf inherits all the way from root
        const leafResolved = resolveStyle({}, midResolved);
        expect(leafResolved.defaultFg).toBe(rootFg);
        expect(leafResolved.defaultBg).toBe(rootBg);
        expect(leafResolved.fg).toBe(rootFg);
        expect(leafResolved.bg).toBe(rootBg);
    });

    it("mid-level override: root → mid(new defaultFg) → leaf", () => {
        const rootFg = packRgb(255, 255, 255);
        const midFg = packRgb(128, 128, 128);

        const rootResolved = resolveStyle({ defaultFg: rootFg }, ROOT_RESOLVED_STYLE);
        const midResolved = resolveStyle({ defaultFg: midFg }, rootResolved);
        const leafResolved = resolveStyle({}, midResolved);

        expect(leafResolved.defaultFg).toBe(midFg);
        expect(leafResolved.fg).toBe(midFg);
    });
});
