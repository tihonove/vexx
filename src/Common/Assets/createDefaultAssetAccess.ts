import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { BundleAssetAccess } from "./BundleAssetAccess.ts";
import { FsAssetAccess } from "./FsAssetAccess.ts";
import type { IAssetAccess } from "./IAssetAccess.ts";

const SEA_BUNDLE_KEY = "vexx.bundle";

/**
 * Возвращает {@link IAssetAccess} для текущего рантайма:
 *
 *   - если процесс — SEA-бинарь (`node:sea.isSea() === true`),
 *     возвращает {@link BundleAssetAccess} над встроенным `vexx.bundle`;
 *   - иначе — {@link FsAssetAccess} с dev-mapping'ом на реальные файлы
 *     в `src/Extensions/builtin/` и `node_modules/vscode-oniguruma`.
 *
 * `node:sea` доступен только через `require()` внутри SEA-сборки —
 * статический ESM-импорт падает даже в работающем SEA executable
 * (`mainFormat: "module"`).
 */
export function createDefaultAssetAccess(): IAssetAccess {
    const bundle = tryLoadSeaBundle();
    if (bundle !== null) return new BundleAssetAccess(bundle);
    return createDevAssetAccess();
}

function tryLoadSeaBundle(): Uint8Array | null {
    try {
        const req = createRequire("file:///");
        const sea = req("node:sea") as { isSea(): boolean; getAsset(key: string): ArrayBuffer };
        if (!sea.isSea()) return null;
        const buffer = sea.getAsset(SEA_BUNDLE_KEY);
        return new Uint8Array(buffer);
    } catch {
        return null;
    }
}

/**
 * Создаёт {@link FsAssetAccess} для dev/test режима. Резолвит реальные пути
 * к `src/Extensions/builtin/` и `node_modules/vscode-oniguruma/.../onig.wasm`
 * относительно расположения этого файла.
 */
export function createDevAssetAccess(): FsAssetAccess {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // src/Common/Assets → src
    const srcRoot = path.resolve(here, "..", "..");
    const builtinDir = path.resolve(srcRoot, "Extensions", "builtin");

    const require = createRequire(import.meta.url);
    const onigWasmPath = require.resolve("vscode-oniguruma/release/onig.wasm");

    return new FsAssetAccess({
        "Extensions/builtin/": builtinDir,
        "onig.wasm": onigWasmPath,
    });
}
