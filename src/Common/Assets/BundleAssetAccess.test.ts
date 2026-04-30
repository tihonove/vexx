import { describe, expect, it } from "vitest";

import { packBundle } from "./AssetBundleFormat.ts";
import { BundleAssetAccess } from "./BundleAssetAccess.ts";

const enc = new TextEncoder();

function makeBundle() {
    return packBundle([
        { virtualPath: "onig.wasm", data: new Uint8Array([0xaa, 0xbb, 0xcc]) },
        { virtualPath: "Extensions/builtin/ts/package.json", data: enc.encode('{"name":"ts"}') },
        { virtualPath: "Extensions/builtin/ts/syntaxes/ts.tmLanguage.json", data: enc.encode("{}") },
        { virtualPath: "Extensions/builtin/css/package.json", data: enc.encode('{"name":"css"}') },
    ]);
}

describe("BundleAssetAccess", () => {
    it("читает entries по виртуальному пути", () => {
        const access = new BundleAssetAccess(makeBundle());
        expect(Array.from(access.read("onig.wasm"))).toEqual([0xaa, 0xbb, 0xcc]);
        expect(access.readText("Extensions/builtin/ts/package.json")).toBe('{"name":"ts"}');
    });

    it("exists() корректно отвечает", () => {
        const access = new BundleAssetAccess(makeBundle());
        expect(access.exists("onig.wasm")).toBe(true);
        expect(access.exists("Extensions/builtin/ts/package.json")).toBe(true);
        expect(access.exists("missing.bin")).toBe(false);
    });

    it("listEntries по корню возвращает верхний уровень", () => {
        const access = new BundleAssetAccess(makeBundle());
        const top = access
            .listEntries("")
            .map((e) => `${e.name}${e.isDirectory ? "/" : ""}`)
            .sort();
        expect(top).toEqual(["Extensions/", "onig.wasm"]);
    });

    it("listEntries по префиксу возвращает дочерние записи", () => {
        const access = new BundleAssetAccess(makeBundle());
        const exts = access
            .listEntries("Extensions/builtin/")
            .map((e) => ({ name: e.name, isDirectory: e.isDirectory }))
            .sort((a, b) => a.name.localeCompare(b.name));
        expect(exts).toEqual([
            { name: "css", isDirectory: true },
            { name: "ts", isDirectory: true },
        ]);

        const tsContents = access
            .listEntries("Extensions/builtin/ts/")
            .map((e) => ({ name: e.name, isDirectory: e.isDirectory }))
            .sort((a, b) => a.name.localeCompare(b.name));
        expect(tsContents).toEqual([
            { name: "package.json", isDirectory: false },
            { name: "syntaxes", isDirectory: true },
        ]);
    });

    it("read бросает на отсутствующий путь", () => {
        const access = new BundleAssetAccess(makeBundle());
        expect(() => access.read("missing.bin")).toThrow(/not found/);
    });

    it("listEntries без trailing / бросает", () => {
        const access = new BundleAssetAccess(makeBundle());
        expect(() => access.listEntries("Extensions/builtin")).toThrow();
    });
});
