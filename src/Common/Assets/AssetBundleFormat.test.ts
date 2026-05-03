import { describe, expect, it } from "vitest";

import { joinVirtualPath, packBundle, readBundleHeader, validateVirtualPath } from "./AssetBundleFormat.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesOf(text: string): Uint8Array {
    return enc.encode(text);
}

function readEntry(bundle: Uint8Array, virtualPath: string): Uint8Array {
    const { header, dataView } = readBundleHeader(bundle);
    const entry = header.files[virtualPath];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (entry === undefined) throw new Error(`missing: ${virtualPath}`);
    return dataView.subarray(entry.offset, entry.offset + entry.size);
}

describe("AssetBundleFormat", () => {
    it("packs and reads a single entry roundtrip", () => {
        const bundle = packBundle([{ virtualPath: "onig.wasm", data: bytesOf("hello") }]);
        const data = readEntry(bundle, "onig.wasm");
        expect(dec.decode(data)).toBe("hello");
    });

    it("preserves multiple entries with correct offsets", () => {
        const bundle = packBundle([
            { virtualPath: "a.txt", data: bytesOf("alpha") },
            { virtualPath: "nested/b.json", data: bytesOf("{}") },
            { virtualPath: "c.bin", data: new Uint8Array([1, 2, 3, 4]) },
        ]);

        expect(dec.decode(readEntry(bundle, "a.txt"))).toBe("alpha");
        expect(dec.decode(readEntry(bundle, "nested/b.json"))).toBe("{}");
        expect(Array.from(readEntry(bundle, "c.bin"))).toEqual([1, 2, 3, 4]);
    });

    it("rejects bundles with bad magic", () => {
        const bundle = packBundle([{ virtualPath: "x", data: bytesOf("y") }]);
        bundle[0] = 0; // corrupt magic
        expect(() => readBundleHeader(bundle)).toThrow(/magic mismatch/);
    });

    it("rejects truncated bundles", () => {
        const bundle = packBundle([{ virtualPath: "x", data: bytesOf("y") }]);
        const truncated = bundle.subarray(0, 10);
        expect(() => readBundleHeader(truncated)).toThrow();
    });

    it("rejects duplicate paths", () => {
        expect(() =>
            packBundle([
                { virtualPath: "a", data: bytesOf("1") },
                { virtualPath: "a", data: bytesOf("2") },
            ]),
        ).toThrow(/Duplicate/);
    });

    it("validates virtual paths", () => {
        expect(() => {
            validateVirtualPath("");
        }).toThrow();
        expect(() => {
            validateVirtualPath("/abs");
        }).toThrow();
        expect(() => {
            validateVirtualPath("trail/");
        }).toThrow();
        expect(() => {
            validateVirtualPath("a/../b");
        }).toThrow();
        expect(() => {
            validateVirtualPath("a/./b");
        }).toThrow();
        expect(() => {
            validateVirtualPath("a//b");
        }).toThrow();
        expect(() => {
            validateVirtualPath("ok/path/file.json");
        }).not.toThrow();
    });

    it("joinVirtualPath склеивает по POSIX", () => {
        expect(joinVirtualPath("Extensions/builtin/ts", "syntaxes/ts.json")).toBe(
            "Extensions/builtin/ts/syntaxes/ts.json",
        );
        expect(joinVirtualPath("Extensions/builtin/ts/", "syntaxes/ts.json")).toBe(
            "Extensions/builtin/ts/syntaxes/ts.json",
        );
        expect(joinVirtualPath("Extensions/builtin/ts", "./syntaxes/ts.json")).toBe(
            "Extensions/builtin/ts/syntaxes/ts.json",
        );
        expect(joinVirtualPath("", "onig.wasm")).toBe("onig.wasm");
    });
});
