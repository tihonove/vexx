import { parseTree } from "jsonc-parser";

import { createRange } from "../../Editor/IRange.ts";
import type { IMarkerData } from "../../Editor/Markers/IMarker.ts";
import { MarkerSeverity } from "../../Editor/Markers/IMarker.ts";

/**
 * Validates a `settings.json` document against the set of known configuration
 * keys and returns a diagnostic marker for every unknown top-level property —
 * the terminal analogue of VS Code's JSON-schema validation of settings.json,
 * minus the JSON language server. Unknown settings surface as *warnings*
 * ("Unknown Configuration Setting"), matching VS Code.
 *
 * Pure and provider-agnostic: the caller supplies the `isKnownKey` predicate
 * (built from the app + extension configuration defaults), so this stays
 * decoupled from the Configuration layer and is trivially testable.
 */
export function validateSettingsJson(text: string, isKnownKey: (key: string) => boolean): IMarkerData[] {
    const root = parseTree(text);
    if (root === undefined || root.type !== "object") return [];

    const lineStarts = computeLineStarts(text);
    const markers: IMarkerData[] = [];
    // parseTree guarantees an object node carries a `children` array and each of
    // its property children carries a string key node at index 0 (malformed keys
    // never produce a property), so no runtime guards are needed here.
    for (const property of root.children!) {
        const keyNode = property.children![0];
        const key = keyNode.value as string;
        if (isKnownKey(key)) continue;

        const start = offsetToPosition(lineStarts, keyNode.offset);
        const end = offsetToPosition(lineStarts, keyNode.offset + keyNode.length);
        markers.push({
            severity: MarkerSeverity.Warning,
            range: createRange(start.line, start.character, end.line, end.character),
            message: `Unknown Configuration Setting: ${key}`,
            code: "unknownSetting",
            source: "json",
        });
    }
    return markers;
}

/**
 * Flattens a nested configuration-defaults tree into the set of every valid
 * dotted key AND every dotted prefix, so both flat keys (`"editor.tabSize"`)
 * and object-valued parents (`"editor": { … }`) count as known.
 */
export function collectKnownSettingKeys(tree: Readonly<Record<string, unknown>>): Set<string> {
    const keys = new Set<string>();
    const walk = (node: Readonly<Record<string, unknown>>, prefix: string): void => {
        for (const [k, value] of Object.entries(node)) {
            const dotted = prefix === "" ? k : `${prefix}.${k}`;
            keys.add(dotted);
            if (isPlainObject(value)) walk(value, dotted);
        }
    };
    walk(tree, "");
    return keys;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Offsets at which each line begins (`lineStarts[0]` is always 0). */
function computeLineStarts(text: string): number[] {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) === 10 /* \n */) starts.push(i + 1);
    }
    return starts;
}

/** Converts a character offset to a 0-based `{ line, character }` position. */
function offsetToPosition(lineStarts: number[], offset: number): { line: number; character: number } {
    // Largest line whose start is <= offset.
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
        const mid = (low + high + 1) >> 1;
        if (lineStarts[mid] <= offset) low = mid;
        else high = mid - 1;
    }
    return { line: low, character: offset - lineStarts[low] };
}
