import { describe, expect, it } from "vitest";

import { detectIndentation } from "./IndentationDetector.ts";
import { TextDocument } from "./TextDocument.ts";

function makeDoc(lines: string[]): TextDocument {
    return new TextDocument(lines.join("\n"));
}

describe("detectIndentation", () => {
    it("returns null for empty document", () => {
        const doc = makeDoc([]);
        expect(detectIndentation(doc)).toBeNull();
    });

    it("returns null for document with no indented lines", () => {
        const doc = makeDoc(["hello", "world", "foo"]);
        expect(detectIndentation(doc)).toBeNull();
    });

    it("detects tab indentation", () => {
        const doc = makeDoc([
            "function foo() {",
            "\tconst x = 1;",
            "\tif (x) {",
            "\t\treturn x;",
            "\t}",
            "}",
        ]);
        const result = detectIndentation(doc);
        expect(result).not.toBeNull();
        expect(result!.insertSpaces).toBe(false);
    });

    it("detects 2-space indentation", () => {
        const doc = makeDoc([
            "function foo() {",
            "  const x = 1;",
            "  if (x) {",
            "    return x;",
            "  }",
            "}",
        ]);
        const result = detectIndentation(doc);
        expect(result).not.toBeNull();
        expect(result!.insertSpaces).toBe(true);
        expect(result!.tabSize).toBe(2);
    });

    it("detects 4-space indentation", () => {
        const doc = makeDoc([
            "function foo() {",
            "    const x = 1;",
            "    if (x) {",
            "        return x;",
            "    }",
            "}",
        ]);
        const result = detectIndentation(doc);
        expect(result).not.toBeNull();
        expect(result!.insertSpaces).toBe(true);
        expect(result!.tabSize).toBe(4);
    });

    it("prefers tabs when tab lines outnumber space lines", () => {
        const doc = makeDoc([
            "\tline1",
            "\tline2",
            "\tline3",
            "  space1",
        ]);
        const result = detectIndentation(doc);
        expect(result).not.toBeNull();
        expect(result!.insertSpaces).toBe(false);
    });

    it("prefers spaces when space lines outnumber tab lines", () => {
        const doc = makeDoc([
            "\ttab1",
            "  space1",
            "  space2",
            "  space3",
        ]);
        const result = detectIndentation(doc);
        expect(result).not.toBeNull();
        expect(result!.insertSpaces).toBe(true);
    });

    it("ignores fully whitespace-only lines in counting", () => {
        const doc = makeDoc([
            "function foo() {",
            "    const x = 1;",
            "    ",
            "    return x;",
            "}",
        ]);
        const result = detectIndentation(doc);
        expect(result).not.toBeNull();
        expect(result!.insertSpaces).toBe(true);
        expect(result!.tabSize).toBe(4);
    });

    it("returns null when all lines are blank", () => {
        const doc = makeDoc(["", "", ""]);
        expect(detectIndentation(doc)).toBeNull();
    });
});
