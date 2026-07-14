#!/usr/bin/env node
/**
 * Самотест собранного бинаря: он должен **реально стартовать**.
 *
 * История вопроса (#143): предыдущая версия проверки смотрела только на
 * `result.error` от `spawnSync` и запускала бинарь без аргументов. Segfault
 * на Intel macOS даёт `error === undefined`, `status === null`, `signal === "SIGSEGV"`,
 * поэтому крах логировался как «spawn OK, exited with code null» — и битый ассет
 * уехал в релиз. Плюс запуск без аргументов и в норме даёт exit 1 («Usage»),
 * так что по коду возврата отличить краш от нормы было нельзя.
 *
 * Отсюда контракт: `<bin> --version` → `signal === null`, `status === 0`, непустой stdout.
 * `--version` выбран потому, что это единственная ветка, которая гарантированно
 * завершается сама и не требует TTY.
 *
 * Оговорка: `--version` отрабатывает до `createDefaultAssetAccess()`, поэтому самотест
 * ловит краш до `main()`, но не битый `vexx.bundle` — за это отвечают e2e.
 */

import { spawnSync } from "node:child_process";

/**
 * @param {string} binaryPath Абсолютный путь к собранному бинарю.
 * @param {{ timeoutMs?: number, cwd?: string }} [options]
 * @returns {string} Напечатанная бинарём версия (trimmed).
 * @throws {Error} Если бинарь не запустился, упал по сигналу или вернул != 0.
 */
export function smokeTestBinary(binaryPath, options = {}) {
    const { timeoutMs = 30_000, cwd } = options;
    const result = spawnSync(binaryPath, ["--version"], {
        timeout: timeoutMs,
        stdio: "pipe",
        encoding: "utf8",
        ...(cwd !== undefined ? { cwd } : {}),
    });

    if (result.error) {
        throw new Error(`[smoke] Binary cannot be executed (${result.error.code ?? "?"}): ${result.error.message}`);
    }
    if (result.signal !== null) {
        // Ровно этот случай и есть #143: SIGSEGV в статических инициализаторах до main().
        throw new Error(
            `[smoke] Binary crashed with signal ${result.signal} — it does not start at all.\n` +
                `${describeOutput(result)}`,
        );
    }
    if (result.status !== 0) {
        throw new Error(`[smoke] Binary exited with code ${String(result.status)}, expected 0.\n${describeOutput(result)}`);
    }

    const version = (result.stdout ?? "").trim();
    if (version === "") {
        throw new Error(`[smoke] Binary printed no version on stdout.\n${describeOutput(result)}`);
    }
    return version;
}

/** @param {{ stdout?: string, stderr?: string }} result */
function describeOutput(result) {
    return `  stdout: ${JSON.stringify(result.stdout ?? "")}\n  stderr: ${JSON.stringify(result.stderr ?? "")}`;
}
