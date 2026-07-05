import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFileSystemNamespace } from "./FileSystemNamespace.ts";
import { FileSystemError, FileType, Uri } from "./VscodeTypes.ts";

const wfs = createFileSystemNamespace();
const uri = (p: string) => Uri.file(p) as never;

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-wfs-"));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("FileSystemNamespace — writeFile", () => {
    it("создаёт файл и родительские папки", async () => {
        const target = path.join(tmpDir, "nested", "deep", ".editorconfig");
        await wfs.writeFile(uri(target), Buffer.from("root = true\n", "utf8"));
        expect(fs.existsSync(target)).toBe(true);
        expect(fs.readFileSync(target, "utf8")).toBe("root = true\n");
    });

    it("readFile возвращает записанные байты (roundtrip)", async () => {
        const target = path.join(tmpDir, "a.txt");
        const bytes = Buffer.from("привет\n", "utf8");
        await wfs.writeFile(uri(target), bytes);
        const read = await wfs.readFile(uri(target));
        expect(Buffer.from(read).equals(bytes)).toBe(true);
    });
});

describe("FileSystemNamespace — stat", () => {
    it("файл → FileType.File с размером", async () => {
        const target = path.join(tmpDir, "f.txt");
        fs.writeFileSync(target, "hello");
        const s = await wfs.stat(uri(target));
        expect(s.type).toBe(FileType.File);
        expect(s.size).toBe(5);
        expect(typeof s.mtime).toBe("number");
    });

    it("папка → FileType.Directory", async () => {
        const s = await wfs.stat(uri(tmpDir));
        expect(s.type).toBe(FileType.Directory);
    });

    it("несуществующий путь → FileSystemError с code FileNotFound", async () => {
        const missing = path.join(tmpDir, "nope.txt");
        await expect(wfs.stat(uri(missing))).rejects.toBeInstanceOf(FileSystemError);
        await expect(wfs.stat(uri(missing))).rejects.toMatchObject({ code: "FileNotFound" });
    });
});

describe("FileSystemNamespace — readFile errors", () => {
    it("readFile несуществующего → FileSystemError FileNotFound", async () => {
        const missing = path.join(tmpDir, "nope.txt");
        await expect(wfs.readFile(uri(missing))).rejects.toMatchObject({ code: "FileNotFound" });
    });
});
