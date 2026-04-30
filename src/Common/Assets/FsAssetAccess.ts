import * as fs from "node:fs";
import * as path from "node:path";

import { validateVirtualPath } from "./AssetBundleFormat.ts";
import type { IAssetAccess, IAssetEntry } from "./IAssetAccess.ts";

/**
 * Маппинг виртуального prefix → абсолютный путь в реальной FS.
 * Префикс должен заканчиваться на `/` (или быть полным виртуальным путём
 * без `/` для одиночных файлов).
 *
 * Пример:
 * ```
 * {
 *   "Extensions/builtin/": "/abs/path/to/src/Extensions/builtin",
 *   "onig.wasm": "/abs/path/to/node_modules/vscode-oniguruma/release/onig.wasm",
 * }
 * ```
 */
export type AssetMapping = Readonly<Record<string, string>>;

/**
 * Реализация {@link IAssetAccess} для dev/tests: читает ассеты напрямую
 * из реальной FS по карте префиксов. Удобно использовать при запуске
 * через `tsx`/`vitest`, когда `src/Extensions/builtin/` лежит на диске.
 */
export class FsAssetAccess implements IAssetAccess {
    private readonly mapping: ReadonlyArray<readonly [string, string]>;

    public constructor(mapping: AssetMapping) {
        // Сортируем префиксы по убыванию длины — иначе `""` проглотит всё.
        this.mapping = Object.entries(mapping).sort((a, b) => b[0].length - a[0].length);
    }

    public read(virtualPath: string): Uint8Array {
        validateVirtualPath(virtualPath);
        const fsPath = this.resolveToFs(virtualPath);
        return fs.readFileSync(fsPath);
    }

    public readText(virtualPath: string): string {
        validateVirtualPath(virtualPath);
        const fsPath = this.resolveToFs(virtualPath);
        return fs.readFileSync(fsPath, "utf-8");
    }

    public exists(virtualPath: string): boolean {
        validateVirtualPath(virtualPath);
        try {
            const fsPath = this.resolveToFs(virtualPath);
            return fs.existsSync(fsPath);
        } catch {
            return false;
        }
    }

    public listEntries(virtualPrefix: string): IAssetEntry[] {
        if (virtualPrefix.length > 0 && !virtualPrefix.endsWith("/")) {
            throw new Error(`listEntries prefix must end with "/" or be empty: ${virtualPrefix}`);
        }
        const fsDir = this.resolveDirToFs(virtualPrefix);
        let dirents: fs.Dirent[];
        try {
            dirents = fs.readdirSync(fsDir, { withFileTypes: true });
        } catch {
            return [];
        }
        return dirents.map((d) => ({ name: d.name, isDirectory: d.isDirectory() }));
    }

    private resolveToFs(virtualPath: string): string {
        for (const [prefix, root] of this.mapping) {
            if (prefix.endsWith("/")) {
                if (virtualPath.startsWith(prefix)) {
                    const tail = virtualPath.slice(prefix.length);
                    return path.join(root, tail);
                }
            } else if (virtualPath === prefix) {
                return root;
            }
        }
        throw new Error(`No FS mapping for virtual path: ${virtualPath}`);
    }

    private resolveDirToFs(virtualPrefix: string): string {
        if (virtualPrefix === "") {
            // Слушать корень имеет смысл только если кто-то замапил "" → root,
            // чего мы пока не делаем. Для текущих задач достаточно map по
            // конкретному префиксу.
            for (const [prefix, root] of this.mapping) {
                if (prefix === "") return root;
            }
            throw new Error('No FS mapping for empty virtual prefix ("").');
        }
        for (const [prefix, root] of this.mapping) {
            if (!prefix.endsWith("/")) continue;
            if (virtualPrefix === prefix) return root;
            if (virtualPrefix.startsWith(prefix)) {
                const tail = virtualPrefix.slice(prefix.length, -1); // strip trailing "/"
                return path.join(root, tail);
            }
        }
        throw new Error(`No FS mapping for virtual prefix: ${virtualPrefix}`);
    }
}
