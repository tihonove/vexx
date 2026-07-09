import { describe, expect, it } from "vitest";

import { computeNewLinePlan, getLeadingWhitespace } from "./AutoIndent.ts";

describe("getLeadingWhitespace", () => {
    it("returns spaces", () => {
        expect(getLeadingWhitespace("    foo")).toBe("    ");
    });

    it("returns tabs", () => {
        expect(getLeadingWhitespace("\t\tfoo")).toBe("\t\t");
    });

    it("returns mixed leading whitespace, stopping at first non-space/tab", () => {
        expect(getLeadingWhitespace("\t  foo\tbar")).toBe("\t  ");
    });

    it("returns empty string for a line without indentation", () => {
        expect(getLeadingWhitespace("foo")).toBe("");
    });

    it("returns the whole line when it is only whitespace", () => {
        expect(getLeadingWhitespace("   ")).toBe("   ");
    });
});

describe("computeNewLinePlan", () => {
    const spaces = { tabSize: 4, insertSpaces: true };
    const tabs = { tabSize: 4, insertSpaces: false };

    it("carries the current line's indentation (spaces)", () => {
        const plan = computeNewLinePlan({ lineContent: "    foo", column: 7, ...spaces });
        expect(plan).toEqual({ editText: "\n    ", blockExpand: false, cursorColumn: 4 });
    });

    it("carries the current line's indentation (tabs)", () => {
        const plan = computeNewLinePlan({ lineContent: "\t\tfoo", column: 4, ...tabs });
        expect(plan).toEqual({ editText: "\n\t\t", blockExpand: false, cursorColumn: 2 });
    });

    it("adds no indentation on a top-level line", () => {
        const plan = computeNewLinePlan({ lineContent: "foo", column: 3, ...spaces });
        expect(plan).toEqual({ editText: "\n", blockExpand: false, cursorColumn: 0 });
    });

    it("increases indent one level after an opening brace", () => {
        const plan = computeNewLinePlan({ lineContent: "    if (x) {", column: 12, ...spaces });
        expect(plan).toEqual({ editText: "\n        ", blockExpand: false, cursorColumn: 8 });
    });

    it("increases indent after an opening bracket followed by trailing whitespace", () => {
        const plan = computeNewLinePlan({ lineContent: "foo(  ", column: 6, ...spaces });
        expect(plan).toEqual({ editText: "\n    ", blockExpand: false, cursorColumn: 4 });
    });

    it("increases indent one level after an opening brace (tabs)", () => {
        const plan = computeNewLinePlan({ lineContent: "\tif {", column: 5, ...tabs });
        expect(plan).toEqual({ editText: "\n\t\t", blockExpand: false, cursorColumn: 2 });
    });

    it("expands a block when the cursor sits between a bracket pair", () => {
        const plan = computeNewLinePlan({ lineContent: "    foo() {}", column: 11, ...spaces });
        expect(plan).toEqual({ editText: "\n        \n    ", blockExpand: true, cursorColumn: 8 });
    });

    it("expands a block for square and round brackets too", () => {
        expect(computeNewLinePlan({ lineContent: "[]", column: 1, ...spaces })).toEqual({
            editText: "\n    \n",
            blockExpand: true,
            cursorColumn: 4,
        });
        expect(computeNewLinePlan({ lineContent: "()", column: 1, ...spaces })).toEqual({
            editText: "\n    \n",
            blockExpand: true,
            cursorColumn: 4,
        });
    });

    it("does not expand when the next char is a non-matching closer", () => {
        const plan = computeNewLinePlan({ lineContent: "{]", column: 1, ...spaces });
        expect(plan).toEqual({ editText: "\n    ", blockExpand: false, cursorColumn: 4 });
    });

    it("caps carried indentation at the cursor column when inside the indent", () => {
        const plan = computeNewLinePlan({ lineContent: "        foo", column: 4, ...spaces });
        expect(plan).toEqual({ editText: "\n    ", blockExpand: false, cursorColumn: 4 });
    });

    it("adds no indentation when Enter is pressed at column 0", () => {
        const plan = computeNewLinePlan({ lineContent: "    foo", column: 0, ...spaces });
        expect(plan).toEqual({ editText: "\n", blockExpand: false, cursorColumn: 0 });
    });
});
