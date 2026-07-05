import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { copyInto, isInside, moveInto, resolveNonConflictingDest } from "./fileClipboardFs.ts";

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-fileclip-"));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function write(rel: string, content = "x"): string {
    const full = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    return full;
}

describe("resolveNonConflictingDest", () => {
    it("returns the direct path when no conflict", () => {
        expect(resolveNonConflictingDest(tmpDir, "a.txt")).toBe(path.join(tmpDir, "a.txt"));
    });

    it("appends ' copy' preserving the extension", () => {
        write("a.txt");
        expect(resolveNonConflictingDest(tmpDir, "a.txt")).toBe(path.join(tmpDir, "a copy.txt"));
    });

    it("increments the copy counter on repeated conflicts", () => {
        write("a.txt");
        write("a copy.txt");
        expect(resolveNonConflictingDest(tmpDir, "a.txt")).toBe(path.join(tmpDir, "a copy 2.txt"));
    });

    it("handles directories (no extension)", () => {
        fs.mkdirSync(path.join(tmpDir, "dir"));
        expect(resolveNonConflictingDest(tmpDir, "dir")).toBe(path.join(tmpDir, "dir copy"));
    });
});

describe("isInside", () => {
    it("treats a directory as inside itself", () => {
        expect(isInside("/a/b", "/a/b")).toBe(true);
    });

    it("detects nested paths", () => {
        expect(isInside("/a/b", "/a/b/c")).toBe(true);
    });

    it("rejects siblings and parents", () => {
        expect(isInside("/a/b", "/a/c")).toBe(false);
        expect(isInside("/a/b", "/a")).toBe(false);
    });
});

describe("copyInto", () => {
    it("copies a file into the target and keeps the source", () => {
        const src = write("src/a.txt", "hello");
        const target = path.join(tmpDir, "dst");
        fs.mkdirSync(target);

        const dest = copyInto(src, target);

        expect(dest).toBe(path.join(target, "a.txt"));
        expect(fs.readFileSync(dest, "utf8")).toBe("hello");
        expect(fs.existsSync(src)).toBe(true);
    });

    it("auto-renames on collision", () => {
        const src = write("a.txt", "v1");
        const target = path.join(tmpDir, "dst");
        fs.mkdirSync(target);
        fs.writeFileSync(path.join(target, "a.txt"), "existing");

        const dest = copyInto(src, target);

        expect(dest).toBe(path.join(target, "a copy.txt"));
        expect(fs.readFileSync(dest, "utf8")).toBe("v1");
    });

    it("copies directories recursively", () => {
        write("tree/inner/file.txt", "deep");
        const target = path.join(tmpDir, "dst");
        fs.mkdirSync(target);

        const dest = copyInto(path.join(tmpDir, "tree"), target);

        expect(fs.readFileSync(path.join(dest, "inner/file.txt"), "utf8")).toBe("deep");
    });

    it("throws when copying a directory into itself", () => {
        fs.mkdirSync(path.join(tmpDir, "d/sub"), { recursive: true });
        expect(() => copyInto(path.join(tmpDir, "d"), path.join(tmpDir, "d/sub"))).toThrow();
    });
});

describe("moveInto", () => {
    it("moves a file and removes the source", () => {
        const src = write("src/a.txt", "hello");
        const target = path.join(tmpDir, "dst");
        fs.mkdirSync(target);

        const dest = moveInto(src, target);

        expect(dest).toBe(path.join(target, "a.txt"));
        expect(fs.readFileSync(dest, "utf8")).toBe("hello");
        expect(fs.existsSync(src)).toBe(false);
    });

    it("is a no-op when the source already lives in the target dir", () => {
        const src = write("a.txt", "v1");
        const dest = moveInto(src, tmpDir);
        expect(dest).toBe(src);
        expect(fs.existsSync(src)).toBe(true);
    });

    it("auto-renames on collision", () => {
        const src = write("src/a.txt", "v1");
        const target = path.join(tmpDir, "dst");
        fs.mkdirSync(target);
        fs.writeFileSync(path.join(target, "a.txt"), "existing");

        const dest = moveInto(src, target);

        expect(dest).toBe(path.join(target, "a copy.txt"));
        expect(fs.readFileSync(dest, "utf8")).toBe("v1");
        expect(fs.existsSync(src)).toBe(false);
    });

    it("throws when moving a directory into itself", () => {
        fs.mkdirSync(path.join(tmpDir, "d/sub"), { recursive: true });
        expect(() => moveInto(path.join(tmpDir, "d"), path.join(tmpDir, "d/sub"))).toThrow();
    });
});
