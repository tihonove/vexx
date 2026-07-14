import { describe, expect, it } from "vitest";

import { createRange } from "../../vs/editor/common/core/range.ts";
import type { IMarker } from "../../vs/platform/markers/common/markers.ts";
import { MarkerSeverity } from "../../vs/platform/markers/common/markers.ts";

import type { ProblemNode } from "./ProblemsTreeDataProvider.ts";
import { ProblemsTreeDataProvider } from "./ProblemsTreeDataProvider.ts";

function marker(resource: string, severity: MarkerSeverity, line: number, message: string, character = 0): IMarker {
    return { owner: "settings", resource, severity, range: createRange(line, character, line, character + 1), message };
}

const COLORS = { error: 0xff0000, warning: 0xffaa00, info: 0x0088ff, hint: 0xaaaaaa };

function provider(markers: IMarker[]): ProblemsTreeDataProvider {
    const p = new ProblemsTreeDataProvider();
    p.severityColors = COLORS;
    p.setMarkers(markers);
    return p;
}

describe("ProblemsTreeDataProvider", () => {
    it("groups markers by resource and sorts files by path", () => {
        // Shuffled input (b, c, a) forces the sort comparator both ways.
        const p = provider([
            marker("/b.json", MarkerSeverity.Warning, 0, "b1"),
            marker("/c.json", MarkerSeverity.Warning, 0, "c1"),
            marker("/a.json", MarkerSeverity.Warning, 0, "a1"),
            marker("/a.json", MarkerSeverity.Warning, 1, "a2"),
        ]);
        const files = p.getChildren() as Extract<ProblemNode, { kind: "file" }>[];
        expect(files.map((f) => f.resource)).toEqual(["/a.json", "/b.json", "/c.json"]);
        expect(p.getChildren(files[0])).toHaveLength(2);
        expect(p.getChildren(files[1])).toHaveLength(1);
    });

    it("sorts markers within a file by severity, then line, then column", () => {
        const p = provider([
            marker("/a.json", MarkerSeverity.Warning, 5, "w-line5"),
            marker("/a.json", MarkerSeverity.Error, 9, "e-line9"),
            marker("/a.json", MarkerSeverity.Error, 2, "e-line2-col3", 3),
            marker("/a.json", MarkerSeverity.Error, 2, "e-line2-col1", 1),
        ]);
        const [file] = p.getChildren();
        const messages = p.getChildren(file).map((n) => (n.kind === "marker" ? n.marker.message : ""));
        expect(messages).toEqual(["e-line2-col1", "e-line2-col3", "e-line9", "w-line5"]);
    });

    it("resolves current markers by resource, tolerating a stale file node", () => {
        const p = provider([marker("/a.json", MarkerSeverity.Error, 0, "x")]);
        const [file] = p.getChildren();
        // Re-snapshot with more markers; the previously-obtained `file` node must
        // still resolve the new markers (data is looked up by resource, not embedded).
        p.setMarkers([
            marker("/a.json", MarkerSeverity.Error, 0, "x"),
            marker("/a.json", MarkerSeverity.Warning, 1, "y"),
        ]);
        expect(p.getChildren(file)).toHaveLength(2);
        expect(p.getTreeItem(file)).toMatchObject({ label: "a.json  (2)" });

        // A file node for a resource with no markers (e.g. cleared) yields nothing.
        const gone: ProblemNode = { kind: "file", resource: "/removed.json" };
        expect(p.getChildren(gone)).toEqual([]);
        expect(p.getTreeItem(gone)).toMatchObject({ label: "removed.json  (0)" });
    });

    it("expands a file into its marker leaves; markers have no children", () => {
        const p = provider([marker("/a.json", MarkerSeverity.Error, 0, "boom")]);
        const [file] = p.getChildren();
        const markerNodes = p.getChildren(file);
        expect(markerNodes).toHaveLength(1);
        expect(markerNodes[0]).toMatchObject({ kind: "marker", resource: "/a.json", index: 0 });
        expect(p.getChildren(markerNodes[0])).toEqual([]);
    });

    it("labels a file node with basename and marker count", () => {
        const p = provider([
            marker("/dir/settings.json", MarkerSeverity.Error, 0, "x"),
            marker("/dir/settings.json", MarkerSeverity.Warning, 1, "y"),
        ]);
        const [file] = p.getChildren();
        expect(p.getTreeItem(file)).toMatchObject({ label: "settings.json  (2)", collapsible: true });
    });

    it("labels a marker with message + 1-based Ln/Col and severity icon/colour", () => {
        const cases = [
            { sev: MarkerSeverity.Error, color: COLORS.error },
            { sev: MarkerSeverity.Warning, color: COLORS.warning },
            { sev: MarkerSeverity.Info, color: COLORS.info },
            { sev: MarkerSeverity.Hint, color: COLORS.hint },
        ];
        for (const { sev, color } of cases) {
            const p = provider([marker("/a.json", sev, 3, "msg", 4)]);
            const [file] = p.getChildren();
            const item = p.getTreeItem(p.getChildren(file)[0]);
            expect(item.label).toBe("msg  [Ln 4, Col 5]");
            expect(item.collapsible).toBe(false);
            expect(item.icon).toBeTruthy();
            expect(item.iconColor).toBe(color);
        }
    });

    it("builds stable keys for files and markers", () => {
        const p = provider([marker("/a.json", MarkerSeverity.Error, 0, "x")]);
        const [file] = p.getChildren();
        expect(p.getKey(file)).toBe("file:/a.json");
        expect(p.getKey(p.getChildren(file)[0])).toBe("marker:/a.json:0");
    });

    it("returns nothing for an empty snapshot", () => {
        const p = provider([]);
        expect(p.getChildren()).toEqual([]);
    });
});
