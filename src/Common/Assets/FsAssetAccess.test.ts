import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FsAssetAccess } from "./FsAssetAccess.ts";

describe("FsAssetAccess", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vexx-fs-asset-"));
        mkdirSync(join(root, "ext", "ts", "syntaxes"), { recursive: true });
        writeFileSync(join(root, "ext", "ts", "package.json"), '{"name":"ts"}');
        writeFileSync(join(root, "ext", "ts", "syntaxes", "ts.tmLanguage.json"), "{}");
        writeFileSync(join(root, "onig.wasm"), Buffer.from([1, 2, 3]));
    });

    afterEach(() => {
        // best-effort cleanup; tmp will be reaped anyway
    });

    it("читает текстовые ассеты по prefix-mapping", async () => {
        const assets = new FsAssetAccess({ "Extensions/builtin/": join(root, "ext") });
        expect(await assets.readText("Extensions/builtin/ts/package.json")).toBe('{"name":"ts"}');
    });

    it("читает бинарные ассеты по exact-mapping", async () => {
        const assets = new FsAssetAccess({ "onig.wasm": join(root, "onig.wasm") });
        expect(Array.from(await assets.read("onig.wasm"))).toEqual([1, 2, 3]);
    });

    it("exists() возвращает true/false", async () => {
        const assets = new FsAssetAccess({ "Extensions/builtin/": join(root, "ext") });
        expect(await assets.exists("Extensions/builtin/ts/package.json")).toBe(true);
        expect(await assets.exists("Extensions/builtin/ts/missing.json")).toBe(false);
    });

    it("listEntries возвращает дочерние записи каталога", async () => {
        const assets = new FsAssetAccess({ "Extensions/builtin/": join(root, "ext") });
        const entries = (await assets.listEntries("Extensions/builtin/")).sort((a, b) => a.name.localeCompare(b.name));
        expect(entries).toEqual([{ name: "ts", isDirectory: true }]);

        const tsEntries = (await assets.listEntries("Extensions/builtin/ts/")).map((e) => e.name).sort();
        expect(tsEntries).toEqual(["package.json", "syntaxes"]);
    });

    it("бросает на путь без mapping", async () => {
        const assets = new FsAssetAccess({ "Extensions/builtin/": join(root, "ext") });
        await expect(assets.read("unmapped.bin")).rejects.toThrow(/No FS mapping/);
    });

    it("validate-ит виртуальные пути (`..` запрещены)", async () => {
        const assets = new FsAssetAccess({ "Extensions/builtin/": join(root, "ext") });
        await expect(assets.read("Extensions/../escape")).rejects.toThrow();
    });
});
