import * as fs from "node:fs/promises";
import * as path from "node:path";

import type * as vscode from "vscode";

import { FileSystemError, FileType } from "./VscodeTypes.ts";

/**
 * `vscode.workspace.fs` на стороне subprocess.
 *
 * Работает **локально через `node:fs`** — целевой файл живёт на той же машине и
 * не является открытым буфером ядра, поэтому RPC не нужен (в отличие от
 * will-save, который ходит за текстом активного документа на хост).
 *
 * Реализована полная запись/чтение поверхности `vscode.FileSystem`
 * (`stat`/`readDirectory`/`createDirectory`/`readFile`/`writeFile`/`delete`/
 * `rename`/`copy`/`isWritableFileSystem`) — расширение, зовущее любой из этих
 * методов, получает ожидаемое поведение, а не `TypeError`.
 *
 * Ошибки `node` маппятся в {@link FileSystemError} с тем же `code`, что и в
 * VS Code, чтобы расширения ловили их по `err.code === "FileNotFound"`.
 */
export type IFileSystemNamespace = Pick<
    vscode.FileSystem,
    | "stat"
    | "readDirectory"
    | "createDirectory"
    | "readFile"
    | "writeFile"
    | "delete"
    | "rename"
    | "copy"
    | "isWritableFileSystem"
>;

/** Преобразует ошибку `node:fs` в {@link FileSystemError}; прочее пробрасывает. */
export function toFileSystemError(err: unknown, uri: vscode.Uri): unknown {
    const code = (err as NodeJS.ErrnoException | null)?.code;
    switch (code) {
        case "ENOENT":
            return FileSystemError.FileNotFound(uri);
        case "EEXIST":
            return FileSystemError.FileExists(uri);
        case "ENOTDIR":
            return FileSystemError.FileNotADirectory(uri);
        case "EISDIR":
            return FileSystemError.FileIsADirectory(uri);
        case "EACCES":
        case "EPERM":
            return FileSystemError.NoPermissions(uri);
        default:
            return err;
    }
}

/** Минимум `fs.Stats`, нужный для определения {@link FileType}. */
interface IStatKind {
    isFile(): boolean;
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
}

/** Классифицирует запись ФС в {@link FileType}. */
export function fileTypeFromStats(s: IStatKind): FileType {
    if (s.isFile()) return FileType.File;
    if (s.isDirectory()) return FileType.Directory;
    if (s.isSymbolicLink()) return FileType.SymbolicLink;
    return FileType.Unknown;
}

export function createFileSystemNamespace(): IFileSystemNamespace {
    async function stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        try {
            const s = await fs.stat(uri.fsPath);
            return {
                type: fileTypeFromStats(s) as vscode.FileType,
                ctime: s.ctimeMs,
                mtime: s.mtimeMs,
                size: s.size,
            };
        } catch (err) {
            throw toFileSystemError(err, uri);
        }
    }

    async function readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        try {
            const entries = await fs.readdir(uri.fsPath, { withFileTypes: true });
            return entries.map((e) => [e.name, fileTypeFromStats(e) as vscode.FileType]);
        } catch (err) {
            throw toFileSystemError(err, uri);
        }
    }

    async function createDirectory(uri: vscode.Uri): Promise<void> {
        try {
            // VS Code: mkdirp-семантика — недостающие родители создаются автоматически.
            await fs.mkdir(uri.fsPath, { recursive: true });
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

    async function del(uri: vscode.Uri, options?: { recursive?: boolean; useTrash?: boolean }): Promise<void> {
        try {
            // Корзину (`useTrash`) не поддерживаем — как и VS Code без backend'а,
            // падаем на перманентное удаление.
            await fs.rm(uri.fsPath, { recursive: options?.recursive ?? false });
        } catch (err) {
            throw toFileSystemError(err, uri);
        }
    }

    async function rename(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void> {
        try {
            if (options?.overwrite !== true && (await exists(target.fsPath))) {
                throw FileSystemError.FileExists(target);
            }
            await fs.mkdir(path.dirname(target.fsPath), { recursive: true });
            await fs.rename(source.fsPath, target.fsPath);
        } catch (err) {
            throw toFileSystemError(err, source);
        }
    }

    async function copy(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void> {
        try {
            if (options?.overwrite !== true && (await exists(target.fsPath))) {
                throw FileSystemError.FileExists(target);
            }
            await fs.mkdir(path.dirname(target.fsPath), { recursive: true });
            await fs.cp(source.fsPath, target.fsPath, { recursive: true, force: options?.overwrite ?? false });
        } catch (err) {
            throw toFileSystemError(err, source);
        }
    }

    function isWritableFileSystem(scheme: string): boolean | undefined {
        // Знаем только `file` (локальный диск) — он записываемый. Прочие схемы
        // редактору неизвестны → `undefined`, как в VS Code.
        return scheme === "file" ? true : undefined;
    }

    return {
        stat,
        readDirectory,
        createDirectory,
        readFile,
        writeFile,
        delete: del,
        rename,
        copy,
        isWritableFileSystem,
    };
}

/** `true`, если путь существует (без различения типа записи). */
async function exists(fsPath: string): Promise<boolean> {
    try {
        await fs.stat(fsPath);
        return true;
    } catch {
        return false;
    }
}
