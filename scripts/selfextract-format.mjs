/**
 * Формат самораспаковывающегося файла: склейка стаба и payload'а.
 *
 *     [ #!/bin/sh стаб (selfextract-stub.sh) ][ payload.tar.gz ]
 *
 * Отделено от `build-selfextract.mjs` намеренно, по двум причинам:
 *   - это чистая работа с байтами, тестируемая без сборки (см. e2e/build-smoke.test.ts);
 *   - тесту незачем тянуть за собой весь пайплайн сборки (tsup, esbuild, pack-assets).
 *
 * Без шебанга сознательно: файл импортируется из тестов, а vitest на Windows инлайнит
 * его через esbuild transform, который (в отличие от bundle) шебанг НЕ срезает — `#!`
 * остаётся в ESM-выводе и падает как SyntaxError.
 */

import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Путь к шаблону стаба. */
const STUB_TEMPLATE_PATH = join(import.meta.dirname, "selfextract-stub.sh");

/**
 * Клеит стаб и payload в готовый исполняемый файл.
 * @param {{ outputPath: string, payload: Buffer, key: string }} params
 */
export function writeSelfExtract({ outputPath, payload, key }) {
    const template = readFileSync(STUB_TEMPLATE_PATH, "utf8");
    if (!template.includes("@@OFFSET@@") || !template.includes("@@KEY@@")) {
        throw new Error("[selfextract] Stub is missing @@OFFSET@@ / @@KEY@@ placeholders");
    }

    const stub = renderStub(template.replace("@@KEY@@", key));
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, Buffer.concat([Buffer.from(stub, "utf8"), payload]));
    chmodSync(outputPath, 0o755);
    verifyOffset(outputPath, stub);
}

/**
 * Подставляет в стаб offset payload'а — длину самого стаба в байтах (+1, т.к.
 * `tail -c +N` 1-based). Задача рекурсивна: подстановка меняет длину, от которой
 * зависит подставляемое число. Решаем итерацией до неподвижной точки.
 *
 * Ведущими нулями до фиксированной ширины это НЕ решается, хотя и соблазнительно:
 * BSD tail на macOS читает `0000003427` как ВОСЬМЕРИЧНОЕ (все цифры валидны в
 * octal, поэтому парсится молча и целиком) → 1815 вместо 3427, tar получает текст
 * стаба вместо gzip. GNU tail на Linux то же число читает как десятичное, поэтому
 * баг воспроизводился только на macOS. Число в стабе обязано быть без ведущих нулей.
 *
 * @param {string} template Стаб со всеми плейсхолдерами кроме `@@OFFSET@@`.
 * @returns {string}
 */
export function renderStub(template) {
    let offset = Buffer.byteLength(template.replace("@@OFFSET@@", "0"), "utf8") + 1;
    for (let i = 0; i < 8; i++) {
        const stub = template.replace("@@OFFSET@@", String(offset));
        const actual = Buffer.byteLength(stub, "utf8") + 1;
        if (actual === offset) return stub;
        offset = actual;
    }
    throw new Error("[selfextract] Stub offset did not converge");
}

/**
 * Контракт склейки: по байту OFFSET готового файла обязан начинаться gzip (magic 1f 8b) —
 * ровно это и прочитает `tail -c "+$OFFSET" "$0"` в стабе. Читаем записанный файл, а не
 * буфер в памяти: так проверяется то, что реально уедет в релиз.
 *
 * Нужно потому, что при кросс-сборке (`--target` != хост) самотест не запускается, и
 * ошибка в offset осталась бы незамеченной до первого запуска пользователем.
 *
 * @param {string} outputPath
 * @param {string} stub Отрендеренный стаб — из него же берём OFFSET, как его увидит sh.
 */
export function verifyOffset(outputPath, stub) {
    const declared = /^OFFSET=(\d+)$/m.exec(stub);
    if (declared === null) throw new Error("[selfextract] Cannot find OFFSET= line in the rendered stub");
    if (declared[1].length > 1 && declared[1].startsWith("0")) {
        throw new Error(`[selfextract] OFFSET has a leading zero: ${declared[1]} (BSD tail would read it as octal)`);
    }

    const offset = Number(declared[1]);
    const fd = openSync(outputPath, "r");
    try {
        const magic = Buffer.alloc(2);
        readSync(fd, magic, 0, 2, offset - 1); // tail -c +N — 1-based
        if (magic[0] !== 0x1f || magic[1] !== 0x8b) {
            throw new Error(
                `[selfextract] No gzip magic at OFFSET=${String(offset)} (got ${magic.toString("hex")}) — ` +
                    `stub and payload are out of sync`,
            );
        }
    } finally {
        closeSync(fd);
    }
}
