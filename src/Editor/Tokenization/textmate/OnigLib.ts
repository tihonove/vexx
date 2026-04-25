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
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve("vscode-oniguruma/release/onig.wasm");
    const wasmBytes = fs.readFileSync(wasmPath);
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
