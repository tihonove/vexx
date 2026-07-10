import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFileSystemNamespace, fileTypeFromStats, toFileSystemError } from "./FileSystemNamespace.ts";
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

describe("FileSystemNamespace — writeFile errors", () => {
    it("writeFile под существующим файлом (родитель — не папка) → бросает", async () => {
        // Делаем файл, затем пишем «внутрь» него: mkdir(dirname) упадёт.
        const asFile = path.join(tmpDir, "afile");
        fs.writeFileSync(asFile, "x");
        await expect(wfs.writeFile(uri(path.join(asFile, "child.txt")), Buffer.from("y"))).rejects.toThrow();
    });
});

describe("FileSystemNamespace — readDirectory", () => {
    it("возвращает записи с их FileType", async () => {
        fs.writeFileSync(path.join(tmpDir, "file.txt"), "x");
        fs.mkdirSync(path.join(tmpDir, "sub"));
        const entries = await wfs.readDirectory(uri(tmpDir));
        const byName = new Map(entries);
        expect(byName.get("file.txt")).toBe(FileType.File);
        expect(byName.get("sub")).toBe(FileType.Directory);
    });

    it("несуществующая папка → FileNotFound", async () => {
        await expect(wfs.readDirectory(uri(path.join(tmpDir, "nope")))).rejects.toMatchObject({
            code: "FileNotFound",
        });
    });

    it("файл вместо папки → FileNotADirectory", async () => {
        const asFile = path.join(tmpDir, "afile");
        fs.writeFileSync(asFile, "x");
        await expect(wfs.readDirectory(uri(asFile))).rejects.toMatchObject({ code: "FileNotADirectory" });
    });
});

describe("FileSystemNamespace — createDirectory", () => {
    it("создаёт папку с недостающими родителями (mkdirp)", async () => {
        const target = path.join(tmpDir, "a", "b", "c");
        await wfs.createDirectory(uri(target));
        expect(fs.statSync(target).isDirectory()).toBe(true);
    });

    it("на существующей папке — не бросает", async () => {
        await expect(wfs.createDirectory(uri(tmpDir))).resolves.toBeUndefined();
    });

    it("когда предок — файл → бросает FileSystemError", async () => {
        const asFile = path.join(tmpDir, "afile");
        fs.writeFileSync(asFile, "x");
        await expect(wfs.createDirectory(uri(path.join(asFile, "child")))).rejects.toBeInstanceOf(FileSystemError);
    });
});

describe("FileSystemNamespace — delete", () => {
    it("удаляет файл", async () => {
        const target = path.join(tmpDir, "f.txt");
        fs.writeFileSync(target, "x");
        await wfs.delete(uri(target));
        expect(fs.existsSync(target)).toBe(false);
    });

    it("recursive:true удаляет непустую папку", async () => {
        const dir = path.join(tmpDir, "d");
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, "f"), "x");
        await wfs.delete(uri(dir), { recursive: true });
        expect(fs.existsSync(dir)).toBe(false);
    });

    it("непустая папка без recursive → бросает", async () => {
        const dir = path.join(tmpDir, "d");
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, "f"), "x");
        await expect(wfs.delete(uri(dir))).rejects.toThrow();
    });

    it("несуществующий путь → FileNotFound", async () => {
        await expect(wfs.delete(uri(path.join(tmpDir, "nope")))).rejects.toMatchObject({ code: "FileNotFound" });
    });
});

describe("FileSystemNamespace — rename", () => {
    it("переименовывает файл", async () => {
        const src = path.join(tmpDir, "a.txt");
        const dst = path.join(tmpDir, "b.txt");
        fs.writeFileSync(src, "hi");
        await wfs.rename(uri(src), uri(dst));
        expect(fs.existsSync(src)).toBe(false);
        expect(fs.readFileSync(dst, "utf8")).toBe("hi");
    });

    it("создаёт недостающие родительские папки цели", async () => {
        const src = path.join(tmpDir, "a.txt");
        const dst = path.join(tmpDir, "nested", "b.txt");
        fs.writeFileSync(src, "hi");
        await wfs.rename(uri(src), uri(dst));
        expect(fs.readFileSync(dst, "utf8")).toBe("hi");
    });

    it("цель существует без overwrite → FileExists", async () => {
        const src = path.join(tmpDir, "a.txt");
        const dst = path.join(tmpDir, "b.txt");
        fs.writeFileSync(src, "hi");
        fs.writeFileSync(dst, "old");
        await expect(wfs.rename(uri(src), uri(dst))).rejects.toMatchObject({ code: "FileExists" });
    });

    it("overwrite:true перезаписывает цель", async () => {
        const src = path.join(tmpDir, "a.txt");
        const dst = path.join(tmpDir, "b.txt");
        fs.writeFileSync(src, "new");
        fs.writeFileSync(dst, "old");
        await wfs.rename(uri(src), uri(dst), { overwrite: true });
        expect(fs.readFileSync(dst, "utf8")).toBe("new");
    });
});

describe("FileSystemNamespace — copy", () => {
    it("копирует файл, оставляя источник", async () => {
        const src = path.join(tmpDir, "a.txt");
        const dst = path.join(tmpDir, "b.txt");
        fs.writeFileSync(src, "hi");
        await wfs.copy(uri(src), uri(dst));
        expect(fs.readFileSync(src, "utf8")).toBe("hi");
        expect(fs.readFileSync(dst, "utf8")).toBe("hi");
    });

    it("копирует папку рекурсивно", async () => {
        const src = path.join(tmpDir, "d");
        fs.mkdirSync(src);
        fs.writeFileSync(path.join(src, "f"), "x");
        const dst = path.join(tmpDir, "d2");
        await wfs.copy(uri(src), uri(dst));
        expect(fs.readFileSync(path.join(dst, "f"), "utf8")).toBe("x");
    });

    it("цель существует без overwrite → FileExists", async () => {
        const src = path.join(tmpDir, "a.txt");
        const dst = path.join(tmpDir, "b.txt");
        fs.writeFileSync(src, "hi");
        fs.writeFileSync(dst, "old");
        await expect(wfs.copy(uri(src), uri(dst))).rejects.toMatchObject({ code: "FileExists" });
    });
});

describe("FileSystemNamespace — isWritableFileSystem", () => {
    it("file → true, прочие схемы → undefined", () => {
        expect(wfs.isWritableFileSystem("file")).toBe(true);
        expect(wfs.isWritableFileSystem("git")).toBeUndefined();
        expect(wfs.isWritableFileSystem("untitled")).toBeUndefined();
    });
});

describe("fileTypeFromStats", () => {
    const kind = (which: "file" | "dir" | "link" | "none") => ({
        isFile: () => which === "file",
        isDirectory: () => which === "dir",
        isSymbolicLink: () => which === "link",
    });
    it("маппит File/Directory/SymbolicLink/Unknown", () => {
        expect(fileTypeFromStats(kind("file"))).toBe(FileType.File);
        expect(fileTypeFromStats(kind("dir"))).toBe(FileType.Directory);
        expect(fileTypeFromStats(kind("link"))).toBe(FileType.SymbolicLink);
        expect(fileTypeFromStats(kind("none"))).toBe(FileType.Unknown);
    });
});

describe("toFileSystemError — маппинг errno", () => {
    const u = uri("/x") as never;
    it("ENOENT → FileNotFound", () => {
        expect(toFileSystemError({ code: "ENOENT" }, u)).toMatchObject({ code: "FileNotFound" });
    });
    it("EEXIST → FileExists", () => {
        expect(toFileSystemError({ code: "EEXIST" }, u)).toMatchObject({ code: "FileExists" });
    });
    it("EACCES / EPERM → NoPermissions", () => {
        expect(toFileSystemError({ code: "EACCES" }, u)).toMatchObject({ code: "NoPermissions" });
        expect(toFileSystemError({ code: "EPERM" }, u)).toMatchObject({ code: "NoPermissions" });
    });
    it("ENOTDIR → FileNotADirectory, EISDIR → FileIsADirectory", () => {
        expect(toFileSystemError({ code: "ENOTDIR" }, u)).toMatchObject({ code: "FileNotADirectory" });
        expect(toFileSystemError({ code: "EISDIR" }, u)).toMatchObject({ code: "FileIsADirectory" });
    });
    it("неизвестный код и не-errno пробрасываются как есть", () => {
        const other = new Error("boom");
        expect(toFileSystemError(other, u)).toBe(other);
        expect(toFileSystemError({ code: "EMFILE" }, u)).toEqual({ code: "EMFILE" });
        expect(toFileSystemError(null, u)).toBeNull();
    });
});
