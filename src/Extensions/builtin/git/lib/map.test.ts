import { describe, expect, it } from "vitest";

import type { IDiffHunk } from "./diff.ts";
import { hunksToGutter, statusToDecoration } from "./map.ts";

describe("statusToDecoration", () => {
    it("maps a modified working-tree file (` M`) to the modified decoration", () => {
        expect(statusToDecoration(" M")).toEqual({
            badge: "M",
            colorId: "gitDecoration.modifiedResourceForeground",
        });
    });

    it("maps a staged add (`A `) to the added decoration", () => {
        expect(statusToDecoration("A ")).toEqual({
            badge: "A",
            colorId: "gitDecoration.addedResourceForeground",
        });
    });

    it("maps a deletion (`D `) to the deleted decoration", () => {
        expect(statusToDecoration("D ")).toEqual({
            badge: "D",
            colorId: "gitDecoration.deletedResourceForeground",
        });
    });

    it("maps a rename (`R `) to the renamed decoration", () => {
        expect(statusToDecoration("R ")).toEqual({
            badge: "R",
            colorId: "gitDecoration.renamedResourceForeground",
        });
    });

    it("maps a copy (`C `) to the renamed decoration", () => {
        expect(statusToDecoration("C ")).toEqual({
            badge: "C",
            colorId: "gitDecoration.renamedResourceForeground",
        });
    });

    it("maps untracked (`??`) to the untracked decoration with a `U` badge", () => {
        expect(statusToDecoration("??")).toEqual({
            badge: "U",
            colorId: "gitDecoration.untrackedResourceForeground",
        });
    });

    it("maps ignored (`!!`) to the ignored decoration with an `I` badge", () => {
        expect(statusToDecoration("!!")).toEqual({
            badge: "I",
            colorId: "gitDecoration.ignoredResourceForeground",
        });
    });

    it("maps an unmerged combination (`UU`) to the conflicting decoration", () => {
        expect(statusToDecoration("UU")).toEqual({
            badge: "U",
            colorId: "gitDecoration.conflictingResourceForeground",
        });
    });

    it("maps a both-deleted conflict (`DD`) to the conflicting decoration", () => {
        expect(statusToDecoration("DD")).toEqual({
            badge: "U",
            colorId: "gitDecoration.conflictingResourceForeground",
        });
    });

    it("prefers the index status over the working tree (`MD` → modified)", () => {
        expect(statusToDecoration("MD").badge).toBe("M");
    });

    it("falls back to the working-tree status when the index is clean (` A` → added)", () => {
        expect(statusToDecoration(" A").badge).toBe("A");
    });

    it("falls back to the modified decoration for an unknown code (`TT`)", () => {
        expect(statusToDecoration("TT")).toEqual({
            badge: "M",
            colorId: "gitDecoration.modifiedResourceForeground",
        });
    });
});

describe("hunksToGutter", () => {
    it("returns an empty list for no hunks", () => {
        expect(hunksToGutter([])).toEqual([]);
    });

    it("maps an added hunk to a range spanning its lines", () => {
        const hunks: IDiffHunk[] = [{ start: 1, count: 3, kind: "added" }];
        expect(hunksToGutter(hunks)).toEqual([
            { range: { startLine: 1, endLine: 3 }, colorId: "editorGutter.addedBackground" },
        ]);
    });

    it("maps a modified hunk to the modified gutter color", () => {
        const hunks: IDiffHunk[] = [{ start: 10, count: 2, kind: "modified" }];
        expect(hunksToGutter(hunks)).toEqual([
            { range: { startLine: 10, endLine: 11 }, colorId: "editorGutter.modifiedBackground" },
        ]);
    });

    it("maps a deleted boundary to a single-line range", () => {
        const hunks: IDiffHunk[] = [{ start: 4, count: 1, kind: "deleted" }];
        expect(hunksToGutter(hunks)).toEqual([
            { range: { startLine: 4, endLine: 4 }, colorId: "editorGutter.deletedBackground" },
        ]);
    });

    it("maps several hunks preserving order", () => {
        const hunks: IDiffHunk[] = [
            { start: 1, count: 1, kind: "added" },
            { start: 5, count: 1, kind: "deleted" },
        ];
        expect(hunksToGutter(hunks)).toEqual([
            { range: { startLine: 1, endLine: 1 }, colorId: "editorGutter.addedBackground" },
            { range: { startLine: 5, endLine: 5 }, colorId: "editorGutter.deletedBackground" },
        ]);
    });
});
