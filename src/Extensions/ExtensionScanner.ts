import type { IAssetAccess } from "../Common/Assets/IAssetAccess.ts";

import type { IExtension } from "./IExtension.ts";
import type { IExtensionManifest } from "./IExtensionManifest.ts";

/**
 * Сканирует виртуальный каталог `<rootPrefix><extension>/package.json` через
 * {@link IAssetAccess}, парсит манифесты и возвращает список валидных
 * расширений. `rootPrefix` должен заканчиваться на `/` (например
 * `"Extensions/builtin/"`).
 *
 * Битые манифесты (отсутствие `name`/`publisher`/`version`, невалидный JSON,
 * отсутствующий `package.json`) пропускаются с записью в `console.error` —
 * bootstrap не должен падать из-за одного криво скопированного расширения.
 *
 * Сканирование строго неглубокое: только поддиректории первого уровня под
 * `rootPrefix`. `IExtension.location` устанавливается в виртуальный prefix
 * расширения (с trailing `/`), пригодный для join'а через `joinVirtualPath`.
 */
export async function scanBuiltinExtensions(assets: IAssetAccess, rootPrefix: string): Promise<IExtension[]> {
    if (!rootPrefix.endsWith("/")) {
        throw new Error(`scanBuiltinExtensions: rootPrefix must end with "/": ${rootPrefix}`);
    }

    let entries;
    try {
        entries = assets.listEntries(rootPrefix);
    } catch (err) {
        console.error(`Failed to scan builtin extensions in ${rootPrefix}:`, err);
        return [];
    }

    const result: IExtension[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory) continue;
        const extensionPrefix = `${rootPrefix}${entry.name}/`;
        const manifestPath = `${extensionPrefix}package.json`;

        if (!assets.exists(manifestPath)) {
            // Каталог без package.json — не расширение, тихо пропускаем.
            continue;
        }

        let raw: string;
        try {
            raw = assets.readText(manifestPath);
        } catch (err) {
            console.error(`Failed to read ${manifestPath}:`, err);
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
            location: extensionPrefix,
            isBuiltin: true,
        });
    }
    return result;
}
