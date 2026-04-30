import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { packRgb } from "../src/Rendering/ColorUtils.ts";

import { getBinaryPath } from "./helpers/buildOnce.ts";
import { VexxSession } from "./helpers/runVexx.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const fixturePath = resolve(here, "fixtures", "sample.ts");
const repoRoot = resolve(here, "..");

const KEYWORD_FG = packRgb(0x56, 0x9c, 0xd6);

const itLinuxOnly = process.platform === "linux" ? it : it.skip;

describe("SEA binary — bundled assets", () => {
    let binary = "";
    let session: VexxSession | null = null;

    beforeAll(async () => {
        binary = await getBinaryPath();
    }, 180_000);

    afterEach(async () => {
        if (session) {
            await session.dispose();
            session = null;
        }
    });

    it("dist/ не содержит каталога Extensions/ после сборки (всё внутри vexx.bundle)", () => {
        const distDir = dirname(binary);
        const entries = readdirSync(distDir);
        expect(entries).toContain("vexx.bundle");
        expect(entries).not.toContain("Extensions");
    });

    itLinuxOnly("работает из произвольного cwd без файлов рядом с бинарём — подсветка из bundle", async () => {
        // Скопируем бинарь в пустой временный каталог. Никаких vexx.bundle, никаких Extensions/ рядом.
        const tmp = mkdtempSync(join(tmpdir(), "vexx-sea-isolated-"));
        try {
            const isolatedBinary = join(tmp, "vexx");
            copyFileSync(binary, isolatedBinary);
            // Скопируем фикстуру тоже — без оригинального e2e/fixtures.
            const isolatedFixture = join(tmp, "sample.ts");
            copyFileSync(fixturePath, isolatedFixture);

            // Sanity: рядом с бинарём нет ассетов.
            expect(existsSync(join(tmp, "vexx.bundle"))).toBe(false);
            expect(existsSync(join(tmp, "Extensions"))).toBe(false);

            // Запускаем от того же cwd.
            session = await VexxSession.start({
                args: [isolatedFixture],
                env: { CWD_OVERRIDE: tmp },
            });

            const screen = await session.waitFor(
                (s) => s.findText("const greeting") !== null,
            );

            // Минимальная проверка подсветки — `const` должен быть keyword-цветом,
            // что доказывает что грамматика реально загрузилась из bundle.
            const constPos = screen.findText("const greeting");
            expect(constPos).not.toBeNull();
            const sample = screen.cellAt(constPos!.x, constPos!.y);
            expect(sample.fg).toBe(KEYWORD_FG);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    it("repoRoot/dist всё ещё содержит vexx.bundle (регресс на сборку)", () => {
        expect(existsSync(join(repoRoot, "dist", "vexx.bundle"))).toBe(true);
    });
});
