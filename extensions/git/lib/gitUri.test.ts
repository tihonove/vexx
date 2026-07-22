import { describe, expect, it } from "vitest";

import { fromGitUri, GIT_SCHEME, toGitUri } from "./gitUri.ts";

describe("toGitUri", () => {
    it("кладёт схему git, сохраняет путь и пишет параметры в query", () => {
        const built = toGitUri({ path: "/repo/src/a.ts", fsPath: "/repo/src/a.ts" }, "HEAD");

        expect(built.scheme).toBe(GIT_SCHEME);
        expect(built.path).toBe("/repo/src/a.ts");
        expect(JSON.parse(built.query)).toEqual({ path: "/repo/src/a.ts", ref: "HEAD" });
    });

    it("в query кладёт fsPath, а не path — они расходятся на Windows", () => {
        const built = toGitUri({ path: "/C:/repo/a.ts", fsPath: "C:\\repo\\a.ts" }, "HEAD");

        expect(JSON.parse(built.query)).toEqual({ path: "C:\\repo\\a.ts", ref: "HEAD" });
    });

    it("пустой ref (индекс) — валидная ревизия", () => {
        expect(JSON.parse(toGitUri({ path: "/a.ts", fsPath: "/a.ts" }, "").query)).toEqual({ path: "/a.ts", ref: "" });
    });
});

describe("fromGitUri", () => {
    it("round-trip возвращает исходные параметры", () => {
        const built = toGitUri({ path: "/repo/a.ts", fsPath: "/repo/a.ts" }, "HEAD");

        expect(fromGitUri({ scheme: built.scheme, query: built.query })).toEqual({ path: "/repo/a.ts", ref: "HEAD" });
    });

    it("чужая схема — null", () => {
        expect(fromGitUri({ scheme: "file", query: '{"path":"/a.ts","ref":"HEAD"}' })).toBeNull();
    });

    it("неразбираемый query — null, а не исключение", () => {
        expect(fromGitUri({ scheme: "git", query: "не json" })).toBeNull();
    });

    it("структурно чужой query — null", () => {
        for (const query of ["null", '"строка"', "42", "{}", '{"ref":"HEAD"}', '{"path":"/a.ts"}']) {
            expect(fromGitUri({ scheme: "git", query })).toBeNull();
        }
    });

    it("пустой path отвергается — читать было бы нечего", () => {
        expect(fromGitUri({ scheme: "git", query: '{"path":"","ref":"HEAD"}' })).toBeNull();
    });

    it("нестроковые поля отвергаются", () => {
        expect(fromGitUri({ scheme: "git", query: '{"path":1,"ref":"HEAD"}' })).toBeNull();
        expect(fromGitUri({ scheme: "git", query: '{"path":"/a.ts","ref":2}' })).toBeNull();
    });
});
