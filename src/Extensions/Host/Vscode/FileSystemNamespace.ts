import * as fs from "node:fs/promises";
import * as path from "node:path";

import type * as vscode from "vscode";

import { FileSystemError, FileType } from "./VscodeTypes.ts";

/**
 * `vscode.workspace.fs` на стороне subprocess.
 *
 * Работает **локально через `node:fs`** — целевой файл живёт на той же машине и
 * не является открытым буфером ядра, поэтому RPC не нужен (в отличие от
 * will-save, который ходит за текстом активного документа на хост). Реализуем
 * только `stat`/`readFile`/`writeFile` — минимум, нужный команде
 * `EditorConfig.generate` и чтению `.editorconfig` с диска.
 *
 * Ошибки `node` маппятся в {@link FileSystemError} с тем же `code`, что и в
 * VS Code, чтобы расширения ловили их по `err.code === "FileNotFound"`.
 */
export type IFileSystemNamespace = Pick<vscode.FileSystem, "stat" | "readFile" | "writeFile">;

/** Преобразует ошибку `node:fs` в {@link FileSystemError}; прочее пробрасывает. */
function toFileSystemError(err: unknown, uri: vscode.Uri): unknown {
    const code = (err as NodeJS.ErrnoException | null)?.code;
    switch (code) {
        case "ENOENT":
            return FileSystemError.FileNotFound(uri);
        case "EEXIST":
            return FileSystemError.FileExists(uri);
        case "EACCES":
        case "EPERM":
            return FileSystemError.NoPermissions(uri);
        default:
            return err;
    }
}

export function createFileSystemNamespace(): IFileSystemNamespace {
    async function stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        try {
            const s = await fs.stat(uri.fsPath);
            const type = s.isFile()
                ? FileType.File
                : s.isDirectory()
                  ? FileType.Directory
                  : s.isSymbolicLink()
                    ? FileType.SymbolicLink
                    : FileType.Unknown;
            return {
                type: type as vscode.FileType,
                ctime: s.ctimeMs,
                mtime: s.mtimeMs,
                size: s.size,
            };
        } catch (err) {
            throw toFileSystemError(err, uri);
        }
    }

    async function readFile(uri: vscode.Uri): Promise<Uint8Array> {
        try {
            return await fs.readFile(uri.fsPath);
        } catch (err) {
            throw toFileSystemError(err, uri);
        }
    }

    async function writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
        try {
            // VS Code создаёт недостающие родительские папки при записи.
            await fs.mkdir(path.dirname(uri.fsPath), { recursive: true });
            await fs.writeFile(uri.fsPath, content);
        } catch (err) {
            throw toFileSystemError(err, uri);
        }
    }

    return { stat, readFile, writeFile };
}
