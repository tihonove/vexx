import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// @ts-expect-error — build-скрипты живут в .mjs без типов (они не должны зависеть от tsx/jiti).
import { smokeTestBinary } from "../scripts/smoke-binary.mjs";

/**
 * Регресс на первопричину #143: самотест сборки обязан ПАДАТЬ на бинаре, который
 * не стартует. Прошлая версия проверки смотрела только на `error` от spawnSync,
 * поэтому segfault выглядел как «spawn OK, exited with code null», и битый
 * vexx-macos-x64 уехал в релиз.
 *
 * Живёт в e2e, а не в юнитах: `scripts/` не входит ни в один vitest-include, и
 * втягивать его в unit-конфиг = втягивать в храповик 100% покрытия. Сборка бинаря
 * тесту не нужна — «бинари» здесь это sh-скрипты, поэтому тест быстрый.
 */
describe.skipIf(process.platform === "win32")("smokeTestBinary — самотест сборки", () => {
    let dir = "";

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "vexx-smoke-"));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    /** Кладёт исполняемый sh-скрипт, притворяющийся собранным бинарём. */
    function fakeBinary(name: string, body: string): string {
        const path = join(dir, name);
        writeFileSync(path, `#!/bin/sh\n${body}\n`);
        chmodSync(path, 0o755);
        return path;
    }

    it("падает на бинаре, который крашится по SIGSEGV (регресс #143)", () => {
        const binary = fakeBinary("segfault", "kill -SEGV $$");
        expect(() => smokeTestBinary(binary)).toThrow(/signal SIGSEGV/);
    });

    it("падает на ненулевом коде возврата", () => {
        const binary = fakeBinary("failing", 'echo "boom" >&2\nexit 3');
        expect(() => smokeTestBinary(binary)).toThrow(/exited with code 3/);
    });

    it("падает, когда бинарь не печатает версию", () => {
        const binary = fakeBinary("silent", "exit 0");
        expect(() => smokeTestBinary(binary)).toThrow(/no version/);
    });

    it("падает, когда бинаря нет или он неисполним", () => {
        expect(() => smokeTestBinary(join(dir, "missing"))).toThrow(/cannot be executed/);
    });

    it("проходит и возвращает версию, когда бинарь стартует", () => {
        const binary = fakeBinary("working", 'echo "0.1.0-nightly"');
        expect(smokeTestBinary(binary)).toBe("0.1.0-nightly");
    });

    it("зовёт бинарь именно с --version (пустые аргументы дают exit 1 «Usage»)", () => {
        // Точная причина, по которой прошлый самотест не мог отличить краш от нормы.
        const binary = fakeBinary("cli", '[ "$1" = "--version" ] || { echo "Usage: vexx <file>" >&2; exit 1; }\necho "1.2.3"');
        expect(smokeTestBinary(binary)).toBe("1.2.3");
    });
});
