import { describe, expect, it } from "vitest";

import { Uri } from "./extHostTypes.ts";

describe("VscodeTypes — Uri (file scheme)", () => {
    it("file() задаёт scheme=file, path=fsPath", () => {
        const u = Uri.file("/a/b.txt");
        expect(u.scheme).toBe("file");
        expect(u.path).toBe("/a/b.txt");
        expect(u.fsPath).toBe("/a/b.txt");
    });

    it("file() добавляет ведущий слэш для относительных путей", () => {
        expect(Uri.file("a/b.txt").path).toBe("/a/b.txt");
    });

    it("parse() разбирает file:// URI", () => {
        const u = Uri.parse("file:///a/b");
        expect(u.scheme).toBe("file");
        expect(u.path).toBe("/a/b");
    });

    it("parse() без пути даёт path='/'", () => {
        const u = Uri.parse("file://host");
        expect(u.scheme).toBe("file");
        expect(u.path).toBe("/");
    });

    it("parse() без схемы трактует строку как file-путь", () => {
        const u = Uri.parse("/plain/path");
        expect(u.scheme).toBe("file");
        expect(u.path).toBe("/plain/path");
    });

    it("joinPath() соединяет только path", () => {
        const u = Uri.joinPath(Uri.file("/a"), "b", "c");
        expect(u.scheme).toBe("file");
        expect(u.path).toBe("/a/b/c");
    });

    it("joinPath() нормализует .. и .", () => {
        expect(Uri.joinPath(Uri.file("/a/b"), "../c").path).toBe("/a/c");
    });

    it("toString() отдаёт file:///...", () => {
        expect(Uri.file("/a/b.txt").toString()).toBe("file:///a/b.txt");
    });
});
