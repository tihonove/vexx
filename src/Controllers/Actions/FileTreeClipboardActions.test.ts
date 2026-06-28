import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { InMemoryFileClipboard } from "../../Common/InMemoryFileClipboard.ts";

import { pasteFiles } from "./FileTreeClipboardActions.ts";

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-paste-"));
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

describe("pasteFiles", () => {
    it("returns an empty result when the clipboard is empty", () => {
        const clip = new InMemoryFileClipboard();
        const result = pasteFiles(clip, tmpDir);
        expect(result).toEqual({ pasted: [], errors: [] });
    });

    it("copies files and keeps the clipboard for a copy", () => {
        const src = write("a.txt", "hello");
        const target = path.join(tmpDir, "dst");
        fs.mkdirSync(target);
        const clip = new InMemoryFileClipboard();
        clip.write([src], "copy");

        const result = pasteFiles(clip, target);

        expect(result.pasted).toEqual([path.join(target, "a.txt")]);
        expect(fs.existsSync(src)).toBe(true);
        expect(clip.read()).not.toBeNull();
    });

    it("moves files and clears the clipboard for a cut", () => {
        const src = write("a.txt", "hello");
        const target = path.join(tmpDir, "dst");
        fs.mkdirSync(target);
        const clip = new InMemoryFileClipboard();
        clip.write([src], "cut");

        const result = pasteFiles(clip, target);

        expect(result.pasted).toEqual([path.join(target, "a.txt")]);
        expect(fs.existsSync(src)).toBe(false);
        expect(clip.read()).toBeNull();
    });

    it("pastes multiple entries", () => {
        const a = write("a.txt");
        const b = write("b.txt");
        const target = path.join(tmpDir, "dst");
        fs.mkdirSync(target);
        const clip = new InMemoryFileClipboard();
        clip.write([a, b], "copy");

        const result = pasteFiles(clip, target);

        expect(result.pasted).toHaveLength(2);
        expect(fs.existsSync(path.join(target, "a.txt"))).toBe(true);
        expect(fs.existsSync(path.join(target, "b.txt"))).toBe(true);
    });

    it("records an error for an invalid entry without aborting the others", () => {
        const good = write("a.txt");
        const dir = path.join(tmpDir, "d");
        fs.mkdirSync(path.join(dir, "sub"), { recursive: true });
        const clip = new InMemoryFileClipboard();
        // Moving `dir` into its own subdir fails; the good file still copies.
        clip.write([dir, good], "copy");

        const result = pasteFiles(clip, path.join(dir, "sub"));

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].path).toBe(dir);
        expect(result.pasted).toEqual([path.join(dir, "sub", "a.txt")]);
    });
});
