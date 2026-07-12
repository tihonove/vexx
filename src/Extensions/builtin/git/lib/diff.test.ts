import { describe, expect, it } from "vitest";

import { parseUnifiedDiffHunks } from "./diff.ts";

describe("parseUnifiedDiffHunks", () => {
    it("returns an empty list for empty input", () => {
        expect(parseUnifiedDiffHunks("")).toEqual([]);
    });

    it("returns an empty list when there are no hunk headers", () => {
        const text = ["diff --git a/x.ts b/x.ts", "index e69de29..0000000"].join("\n");
        expect(parseUnifiedDiffHunks(text)).toEqual([]);
    });

    it("reads an insertion (oldCount 0) as `added` over the new lines", () => {
        const text = [
            "diff --git a/x.ts b/x.ts",
            "@@ -0,0 +1,3 @@",
            "+line one",
            "+line two",
            "+line three",
        ].join("\n");
        expect(parseUnifiedDiffHunks(text)).toEqual([
            { start: 1, count: 3, kind: "added" },
        ]);
    });

    it("reads a deletion (newCount 0) as a single `deleted` boundary line", () => {
        const text = ["@@ -5,3 +4,0 @@", "-a", "-b", "-c"].join("\n");
        expect(parseUnifiedDiffHunks(text)).toEqual([
            { start: 4, count: 1, kind: "deleted" },
        ]);
    });

    it("reads an in-place change as `modified` over the new lines", () => {
        const text = ["@@ -10,2 +10,2 @@", "-old1", "-old2", "+new1", "+new2"].join("\n");
        expect(parseUnifiedDiffHunks(text)).toEqual([
            { start: 10, count: 2, kind: "modified" },
        ]);
    });

    it("defaults omitted counts to 1 (`@@ -N +N @@` → modified, one line)", () => {
        expect(parseUnifiedDiffHunks("@@ -3 +3 @@")).toEqual([
            { start: 3, count: 1, kind: "modified" },
        ]);
    });

    it("defaults an omitted new count on an insertion", () => {
        // `+5` with no count → newCount 1; old `-4,0` → insertion.
        expect(parseUnifiedDiffHunks("@@ -4,0 +5 @@")).toEqual([
            { start: 5, count: 1, kind: "added" },
        ]);
    });

    it("defaults an omitted old count on a modification", () => {
        // `-3` with no count → oldCount 1 (non-zero) → modified.
        expect(parseUnifiedDiffHunks("@@ -3 +3,2 @@")).toEqual([
            { start: 3, count: 2, kind: "modified" },
        ]);
    });

    it("parses multiple hunks in one diff", () => {
        const text = [
            "diff --git a/x.ts b/x.ts",
            "@@ -0,0 +1,1 @@",
            "+added",
            "@@ -5,2 +6,0 @@",
            "-gone1",
            "-gone2",
            "@@ -20,1 +18,1 @@",
            "-was",
            "+is",
        ].join("\n");
        expect(parseUnifiedDiffHunks(text)).toEqual([
            { start: 1, count: 1, kind: "added" },
            { start: 6, count: 1, kind: "deleted" },
            { start: 18, count: 1, kind: "modified" },
        ]);
    });

    it("ignores a `@@ ` line that is not a valid hunk header", () => {
        expect(parseUnifiedDiffHunks("@@ not a hunk @@")).toEqual([]);
    });
});
