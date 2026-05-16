import { describe, expect, it } from "vitest";

import { CompositeAssetAccess } from "./CompositeAssetAccess.ts";
import type { IAssetAccess, IAssetEntry } from "./IAssetAccess.ts";

class FakeAccess implements IAssetAccess {
    public constructor(
        private readonly files: Record<string, string>,
        private readonly entries: Record<string, IAssetEntry[]> = {},
    ) {}

    public async read(p: string): Promise<Uint8Array> {
        const t = this.files[p];
        if (t === undefined) throw new Error(`missing: ${p}`);
        return new TextEncoder().encode(t);
    }
    public async readText(p: string): Promise<string> {
        const t = this.files[p];
        if (t === undefined) throw new Error(`missing: ${p}`);
        return t;
    }
    public async exists(p: string): Promise<boolean> {
        return this.files[p] !== undefined;
    }
    public async listEntries(prefix: string): Promise<IAssetEntry[]> {
        return this.entries[prefix] ?? [];
    }
}

describe("CompositeAssetAccess", () => {
    it("routes to matching prefix", async () => {
        const a = new FakeAccess({ "Extensions/builtin/js/package.json": "builtin" });
        const b = new FakeAccess({ "UserExtensions/foo/package.json": "user" });
        const c = new CompositeAssetAccess({
            "Extensions/builtin/": a,
            "UserExtensions/": b,
        });
        expect(await c.readText("Extensions/builtin/js/package.json")).toBe("builtin");
        expect(await c.readText("UserExtensions/foo/package.json")).toBe("user");
    });

    it("picks the longest matching prefix", async () => {
        const generic = new FakeAccess({ "a/b/c.txt": "generic" });
        const specific = new FakeAccess({ "a/b/c.txt": "specific" });
        const c = new CompositeAssetAccess({ "a/": generic, "a/b/": specific });
        expect(await c.readText("a/b/c.txt")).toBe("specific");
    });

    it("listEntries returns empty for unknown prefix", async () => {
        const a = new FakeAccess({}, { "x/": [{ name: "foo", isDirectory: true }] });
        const c = new CompositeAssetAccess({ "x/": a });
        expect(await c.listEntries("x/")).toEqual([{ name: "foo", isDirectory: true }]);
        expect(await c.listEntries("nope/")).toEqual([]);
    });

    it("exists returns false instead of throwing for unrouted path", async () => {
        const a = new FakeAccess({});
        const c = new CompositeAssetAccess({ "x/": a });
        expect(await c.exists("y/something")).toBe(false);
    });

    it("read throws for unrouted path", async () => {
        const a = new FakeAccess({});
        const c = new CompositeAssetAccess({ "x/": a });
        await expect(c.read("y/file")).rejects.toThrow(/No CompositeAssetAccess route/);
    });

    it("rejects non-empty prefix without trailing slash", () => {
        expect(() => new CompositeAssetAccess({ bad: new FakeAccess({}) })).toThrow(
            /must end with "\/"/,
        );
    });
});
