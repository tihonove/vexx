import { describe, expect, it } from "vitest";

import { DocumentRegistry } from "./ExtHostDocuments.ts";
import { EndOfLine, Position, Range } from "./VscodeTypes.ts";

describe("ExtHostDocuments — DocumentRegistry идентичность", () => {
    it("getOrCreate возвращает ТУ ЖЕ ссылку для того же fileName", () => {
        const reg = new DocumentRegistry();
        const a = reg.getOrCreate("/a.ts");
        const b = reg.getOrCreate("/a.ts");
        expect(a).toBe(b);
        expect(reg.getOrCreate("/other.ts")).not.toBe(a);
    });

    it("upsertMeta/upsertFull мутируют тот же объект (идентичность сохраняется)", () => {
        const reg = new DocumentRegistry();
        const first = reg.upsertMeta({ fileName: "/a.ts" });
        const second = reg.upsertMeta({ fileName: "/a.ts", languageId: "typescript", isDirty: true });
        expect(second).toBe(first);
        expect(first.languageId).toBe("typescript");
        expect(first.isDirty).toBe(true);
        const third = reg.upsertFull({ fileName: "/a.ts", text: "x\n" });
        expect(third).toBe(first);
    });

    it("all() отдаёт все известные документы", () => {
        const reg = new DocumentRegistry();
        reg.getOrCreate("/a.ts");
        reg.getOrCreate("/b.ts");
        expect(reg.all()).toHaveLength(2);
    });

    it("get() возвращает документ или undefined", () => {
        const reg = new DocumentRegistry();
        const doc = reg.getOrCreate("/a.ts");
        expect(reg.get("/a.ts")).toBe(doc);
        expect(reg.get("/missing.ts")).toBeUndefined();
    });
});

describe("ExtHostDocuments — ExtHostTextDocument", () => {
    it("дефолты пустого документа", () => {
        const doc = new DocumentRegistry().getOrCreate("/a.ts");
        expect(doc.languageId).toBe("plaintext");
        expect(doc.isDirty).toBe(false);
        expect(doc.isUntitled).toBe(false);
        expect(doc.encoding).toBe("utf8");
        expect(doc.eol).toBe(EndOfLine.LF);
        expect(doc.version).toBe(0);
        expect(doc.getText()).toBe("");
        expect(doc.lineCount).toBe(1);
        expect(doc.lineAt(0).text).toBe("");
    });

    it("uri соответствует Uri.file(fileName)", () => {
        const doc = new DocumentRegistry().getOrCreate("/dir/file.ts");
        expect(doc.uri.scheme).toBe("file");
        expect(doc.uri.fsPath).toBe("/dir/file.ts");
    });

    it("version растёт только на upsertFull, не на applyMeta", () => {
        const reg = new DocumentRegistry();
        const doc = reg.upsertMeta({ fileName: "/a.ts", isDirty: true });
        expect(doc.version).toBe(0);
        reg.upsertMeta({ fileName: "/a.ts", languageId: "ts" });
        expect(doc.version).toBe(0);
        reg.upsertFull({ fileName: "/a.ts", text: "a\n" });
        expect(doc.version).toBe(1);
        reg.upsertFull({ fileName: "/a.ts", text: "b\n" });
        expect(doc.version).toBe(2);
    });

    it("getText/lineCount отражают снапшот", () => {
        const reg = new DocumentRegistry();
        const doc = reg.upsertFull({ fileName: "/a.ts", text: "line0\nline1\nline2" });
        expect(doc.getText()).toBe("line0\nline1\nline2");
        expect(doc.lineCount).toBe(3);
        expect(doc.lineAt(1).text).toBe("line1");
    });

    it("трейлинг \\n даёт пустую последнюю строку", () => {
        const doc = new DocumentRegistry().upsertFull({ fileName: "/a.ts", text: "a\nb\n" });
        expect(doc.lineCount).toBe(3);
        expect(doc.lineAt(2).text).toBe("");
    });

    it("lineAt(number) и lineAt(Position) эквивалентны", () => {
        const doc = new DocumentRegistry().upsertFull({ fileName: "/a.ts", text: "a\nbb\nccc" });
        expect(doc.lineAt(1)).toEqual(doc.lineAt(new Position(1, 99)));
    });

    it("TextLine: range/rangeIncludingLineBreak (последняя строка без переноса)", () => {
        const doc = new DocumentRegistry().upsertFull({ fileName: "/a.ts", text: "ab\ncd" });
        const l0 = doc.lineAt(0);
        expect(l0.range.end.character).toBe(2);
        expect(l0.rangeIncludingLineBreak.end.line).toBe(1);
        expect(l0.rangeIncludingLineBreak.end.character).toBe(0);
        const l1 = doc.lineAt(1);
        expect(l1.rangeIncludingLineBreak.end.line).toBe(1); // нет переноса
        expect(l1.rangeIncludingLineBreak.end.character).toBe(2);
    });

    it("firstNonWhitespaceCharacterIndex / isEmptyOrWhitespace", () => {
        const doc = new DocumentRegistry().upsertFull({ fileName: "/a.ts", text: "  x\n   \nq" });
        expect(doc.lineAt(0).firstNonWhitespaceCharacterIndex).toBe(2);
        expect(doc.lineAt(0).isEmptyOrWhitespace).toBe(false);
        expect(doc.lineAt(1).firstNonWhitespaceCharacterIndex).toBe(3); // вся whitespace → длина
        expect(doc.lineAt(1).isEmptyOrWhitespace).toBe(true);
        expect(doc.lineAt(2).firstNonWhitespaceCharacterIndex).toBe(0);
    });

    it("lineAt вне диапазона бросает", () => {
        const doc = new DocumentRegistry().upsertFull({ fileName: "/a.ts", text: "a\nb" });
        expect(() => doc.lineAt(5)).toThrow(RangeError);
    });

    it("getText(range) режет по диапазону", () => {
        const doc = new DocumentRegistry().upsertFull({ fileName: "/a.ts", text: "hello\nworld" });
        expect(doc.getText(new Range(0, 1, 0, 4))).toBe("ell");
        expect(doc.getText(new Range(0, 3, 1, 2))).toBe("lo\nwo");
    });

    it("getText(range) через несколько строк включает промежуточные целиком", () => {
        const doc = new DocumentRegistry().upsertFull({ fileName: "/a.ts", text: "one\ntwo\nthree\nfour" });
        expect(doc.getText(new Range(0, 1, 3, 2))).toBe("ne\ntwo\nthree\nfo");
    });
});
