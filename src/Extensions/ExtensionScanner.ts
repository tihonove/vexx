import * as fs from "node:fs";
import * as path from "node:path";

import type { IExtension } from "./IExtension.ts";
import type { IExtensionManifest } from "./IExtensionManifest.ts";

/**
 * Сканирует каталог `<rootDir>/<extension>/package.json`, парсит манифесты
 * и возвращает список валидных расширений.
 *
 * Битые манифесты (отсутствие `name`/`publisher`/`version`, невалидный JSON,
 * отсутствующий `package.json`) пропускаются с записью в `console.error` —
 * bootstrap не должен падать из-за одного криво скопированного расширения.
 *
 * Сканирование строго неглубокое: только поддиректории первого уровня.
 */
export async function scanBuiltinExtensions(rootDir: string): Promise<IExtension[]> {
    let entries: fs.Dirent[];
    try {
        entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
    } catch (err) {
        console.error(`Failed to scan builtin extensions in ${rootDir}:`, err);
        return [];
    }

    const result: IExtension[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const extensionDir = path.join(rootDir, entry.name);
        const manifestPath = path.join(extensionDir, "package.json");

        let raw: string;
        try {
            raw = await fs.promises.readFile(manifestPath, "utf-8");
        } catch {
            // Каталог без package.json — не расширение, тихо пропускаем.
            continue;
        }

        let manifest: IExtensionManifest;
        try {
            manifest = JSON.parse(raw) as IExtensionManifest;
        } catch (err) {
            console.error(`Invalid JSON in ${manifestPath}:`, err);
            continue;
        }

        if (typeof manifest.name !== "string" || manifest.name.length === 0) {
            console.error(`Extension ${manifestPath} has no "name" field`);
            continue;
        }
        if (typeof manifest.publisher !== "string" || manifest.publisher.length === 0) {
            console.error(`Extension ${manifestPath} has no "publisher" field`);
            continue;
        }
        if (typeof manifest.version !== "string" || manifest.version.length === 0) {
            console.error(`Extension ${manifestPath} has no "version" field`);
            continue;
        }

        result.push({
            id: `${manifest.publisher}.${manifest.name}`,
            manifest,
            location: extensionDir,
            isBuiltin: true,
        });
    }
    return result;
}
