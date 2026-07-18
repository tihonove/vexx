import { describe, expect, it } from "vitest";

import { MarkerSeverity } from "../../../Editor/Markers/IMarker.ts";

import { collectKnownSettingKeys, validateSettingsJson } from "./SettingsDiagnostics.ts";

const KNOWN = collectKnownSettingKeys({
    editor: { tabSize: 4, insertSpaces: true },
    workbench: { colorTheme: "Dark Modern" },
});
const isKnown = (key: string): boolean => KNOWN.has(key);

describe("collectKnownSettingKeys", () => {
    it("includes every dotted leaf and every prefix", () => {
        expect(KNOWN.has("editor")).toBe(true);
        expect(KNOWN.has("editor.tabSize")).toBe(true);
        expect(KNOWN.has("editor.insertSpaces")).toBe(true);
        expect(KNOWN.has("workbench.colorTheme")).toBe(true);
    });

    it("does not include unrelated keys", () => {
        expect(KNOWN.has("editor.fontSize")).toBe(false);
        expect(KNOWN.has("telemetry")).toBe(false);
    });
});

describe("validateSettingsJson", () => {
    it("flags an unknown top-level key as a warning", () => {
        const markers = validateSettingsJson(`{ "editor.fontSize": 12 }`, isKnown);
        expect(markers).toHaveLength(1);
        expect(markers[0].severity).toBe(MarkerSeverity.Warning);
        expect(markers[0].message).toContain("editor.fontSize");
        expect(markers[0].source).toBe("json");
    });

    it("ranges the marker over the quoted key", () => {
        //            0         1
        //            0123456789012345678
        const text = `{ "unknown.key": 1 }`;
        const [marker] = validateSettingsJson(text, isKnown);
        // The key string node spans the quotes: offset 2 .. 15.
        expect(marker.range.start).toEqual({ line: 0, character: 2 });
        expect(marker.range.end).toEqual({ line: 0, character: 15 });
    });

    it("computes multi-line positions from offsets", () => {
        const text = ["{", '  "editor.tabSize": 4,', '  "bogus": true', "}"].join("\n");
        const [marker] = validateSettingsJson(text, isKnown);
        expect(marker.message).toContain("bogus");
        expect(marker.range.start).toEqual({ line: 2, character: 2 });
    });

    it("ignores known keys, including object-valued parents", () => {
        const text = `{ "editor.tabSize": 2, "editor": { "insertSpaces": false } }`;
        expect(validateSettingsJson(text, isKnown)).toEqual([]);
    });

    it("returns nothing for a non-object root", () => {
        expect(validateSettingsJson(`[1, 2, 3]`, isKnown)).toEqual([]);
        expect(validateSettingsJson(``, isKnown)).toEqual([]);
    });

    it("tolerates comments and trailing commas (JSONC)", () => {
        const text = ["{", "  // a comment", '  "nope": 1,', "}"].join("\n");
        const markers = validateSettingsJson(text, isKnown);
        expect(markers.map((m) => m.message)).toHaveLength(1);
        expect(markers[0].message).toContain("nope");
    });
});
