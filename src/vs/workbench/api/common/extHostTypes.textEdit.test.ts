import { describe, expect, it } from "vitest";

import { EndOfLine, Position, Range, TextEdit } from "./extHostTypes.ts";

describe("VscodeTypes — TextEdit", () => {
    it("replace задаёт range/newText", () => {
        const r = new Range(1, 0, 1, 5);
        const e = TextEdit.replace(r, "hi");
        expect(e.range).toBe(r);
        expect(e.newText).toBe("hi");
        expect(e.newEol).toBeUndefined();
    });

    it("insert — пустой range в позиции + newText", () => {
        const e = TextEdit.insert(new Position(2, 3), "x");
        expect(e.range.isEmpty).toBe(true);
        expect(e.range.start.isEqual(new Position(2, 3))).toBe(true);
        expect(e.newText).toBe("x");
    });

    it("delete — range + пустой текст", () => {
        const r = new Range(0, 0, 0, 4);
        const e = TextEdit.delete(r);
        expect(e.range).toBe(r);
        expect(e.newText).toBe("");
    });

    it("setEndOfLine — маркерная правка с newEol", () => {
        const e = TextEdit.setEndOfLine(EndOfLine.CRLF);
        expect(e.newEol).toBe(EndOfLine.CRLF);
        expect(e.newText).toBe("");
    });
});
