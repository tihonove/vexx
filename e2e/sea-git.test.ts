import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { AnsiScreen } from "./helpers/AnsiScreen.ts";
import { getBinaryPath } from "./helpers/buildOnce.ts";
import { VexxSession } from "./helpers/runVexx.ts";

// Глифы git-гуттер-бара (см. EditorElement gutter paint): U+2503 сплошной
// (added/deleted) и U+250B штриховой (modified). Оба уникальны для бара —
// indent-guide рисуется `│`.
const GUTTER_BARS = new Set(["┃", "┋"]);

// ConPTY делает посимвольные ассерты экрана ненадёжными вне Linux (см. docs/TODO/E2E.md;
// так же гардятся цветовые ассерты в sea-extensions.test.ts). Функциональную
// корректность на всех платформах покрывает git.integration.test.ts.
const itLinuxOnly = process.platform === "linux" ? it : it.skip;

function git(cwd: string, ...args: string[]): void {
    execFileSync("git", args, { cwd, stdio: "ignore" });
}

/** Временный git-репо: закоммиченный файл + правка строки 2 (→ dirty-diff modified). */
function makeRepo(): { repoDir: string; trackedFile: string } {
    const repoDir = mkdtempSync(join(tmpdir(), "vexx-sea-git-"));
    git(repoDir, "init", "-q");
    git(repoDir, "config", "user.email", "t@example.com");
    git(repoDir, "config", "user.name", "Test");
    git(repoDir, "config", "commit.gpgsign", "false");
    const trackedFile = join(repoDir, "tracked.txt");
    writeFileSync(trackedFile, "alpha\nbravo\ncharlie\n");
    git(repoDir, "add", "-A");
    git(repoDir, "commit", "-qm", "init");
    writeFileSync(trackedFile, "alpha\nBRAVO\ncharlie\n"); // строка 2 изменена
    return { repoDir, trackedFile };
}

/**
 * Есть ли на экране бар-глиф гуттера. Сканируем все столбцы: гуттер редактора
 * смещён вправо панелью EXPLORER, поэтому бар не в столбце 0. Глифы бара уникальны
 * (indent-guide рисуется `│`).
 */
function hasGutterBar(screen: AnsiScreen): boolean {
    for (let y = 0; y < screen.height; y++) {
        for (let x = 0; x < screen.width; x++) {
            if (GUTTER_BARS.has(screen.cellAt(x, y).char)) return true;
        }
    }
    return false;
}

describe("SEA binary — built-in git plugin", () => {
    let session: VexxSession | null = null;
    let repoDir = "";
    let userDataDir = "";
    let trackedFile = "";

    beforeAll(async () => {
        await getBinaryPath();
        ({ repoDir, trackedFile } = makeRepo());
        userDataDir = mkdtempSync(join(tmpdir(), "vexx-sea-git-ud-"));
    }, 180_000);

    afterEach(async () => {
        if (session) {
            await session.dispose();
            session = null;
        }
    });

    afterAll(() => {
        for (const dir of [repoDir, userDataDir]) {
            if (dir) rmSync(dir, { recursive: true, force: true });
        }
    });

    itLinuxOnly("активируется под SEA и рисует dirty-diff бар в гуттере изменённого файла", async () => {
        // Открываем репо как workspace + сам изменённый файл. Плагин (скомпилированный
        // out/extension.cjs, упакованный в vexx.bundle, загруженный в память через
        // Module._compile) должен spawn'ить git и проставить гуттер-бар.
        session = await VexxSession.start({ args: ["--user-data-dir", userDataDir, repoDir, trackedFile] });
        const screen = await session.waitFor((s) => s.findText("BRAVO") !== null && hasGutterBar(s), {
            timeoutMs: 20_000,
        });
        expect(hasGutterBar(screen)).toBe(true);
    });
});
