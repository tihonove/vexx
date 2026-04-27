import * as fs from "node:fs";
import { createRequire } from "node:module";

import oniguruma from "vscode-oniguruma";
import type { IOnigLib } from "vscode-textmate";

/**
 * Singleton initializer for the `vscode-oniguruma` WASM regex engine.
 *
 * `loadWASM` мутирует глобальное состояние модуля и должен вызываться ровно
 * один раз за процесс. Возвращаемый `IOnigLib` совместим с
 * `vscode-textmate` `RegistryOptions.onigLib`.
 *
 * Для dev/tests читаем `onig.wasm` напрямую из `node_modules` через
 * `require.resolve`. Стратегия для production-сборки описана в
 * `docs/TODO/SyntaxHighlighting.md`.
 */

let onigLibPromise: Promise<IOnigLib> | undefined;

export function getOnigLib(): Promise<IOnigLib> {
    onigLibPromise ??= loadOnigLib();
    return onigLibPromise;
}

async function loadOnigLib(): Promise<IOnigLib> {
    // node:sea is only resolvable via require() inside a SEA binary; static ESM
    // import of "node:sea" fails even inside the SEA executable in mainFormat:"module".
    const wasmBytes = tryLoadFromSea() ?? loadFromNodeModules();

    await oniguruma.loadWASM(wasmBytes);
    return {
        createOnigScanner(patterns: string[]) {
            return oniguruma.createOnigScanner(patterns);
        },
        createOnigString(s: string) {
            return oniguruma.createOnigString(s);
        },
    };
}

function tryLoadFromSea(): ArrayBuffer | null {
    try {
        const req = createRequire("file:///");
        const sea = req("node:sea") as { isSea(): boolean; getAsset(key: string): ArrayBuffer };
        if (sea.isSea()) return sea.getAsset("onig.wasm");
    } catch {
        // not running as SEA or node:sea unavailable
    }
    return null;
}

function loadFromNodeModules(): Buffer {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve("vscode-oniguruma/release/onig.wasm");
    return fs.readFileSync(wasmPath);
}
