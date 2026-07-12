/**
 * SPIKE (LSP): гоняет НАСТОЯЩЕЕ приложение (dev, `tsx src/main.ts`) в headless-режиме
 * с включённым LSP-спайком (`VEXX_LSP_SPIKE=1`), открывает .ts с ошибкой типов и
 * ждёт, пока `typescript-language-server` через наш `vscode`-стаб → MarkerService
 * нарисует squiggle и наполнит панель Problems. Снимает PNG.
 *
 * Запуск: `npm run spike:lsp:app`. PNG пишется в `screenshots/lsp-diagnostics.png`.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as path from "node:path";

import type WebSocket from "ws";

import type { GridSnapshot } from "../src/Rendering/GridSnapshot.ts";
import type { InspectorResponse, InspectorSuccessResponse } from "../src/Inspector/protocol.ts";

import { connectWithRetry, freePort } from "./helpers/inspectorClient.ts";
import { frameToText } from "./helpers/headlessSession.ts";
import { saveScreenshot } from "./helpers/renderScreenshot.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const MAIN_TS = path.resolve(here, "..", "src", "main.ts");

const BAD_TS = [
    "// SPIKE: намеренная ошибка типов — её должен подсветить typescript-language-server.",
    'const answer: number = "forty-two";',
    "console.log(answer);",
    "export {};",
    "",
].join("\n");

const COLS = 160;
const ROWS = 44;

async function main(): Promise<void> {
    // По умолчанию — маленький воркспейс-песочница; VEXX_DEMO_WS=<dir> прогоняет против
    // произвольной папки (напр. самого репозитория), VEXX_DEMO_QUERY — что вбить в Quick Open.
    const customWs = process.env.VEXX_DEMO_WS;
    const query = process.env.VEXX_DEMO_QUERY ?? "broken";
    const deadlineMs = Number(process.env.VEXX_DEMO_TIMEOUT ?? "45000");
    let dir: string;
    if (customWs !== undefined) {
        dir = path.resolve(customWs);
    } else {
        dir = mkdtempSync(path.join(tmpdir(), "vexx-lsp-app-"));
        writeFileSync(path.join(dir, "broken.ts"), BAD_TS, "utf8");
        writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true } }), "utf8");
    }
    console.log("[lsp-app] workspace:", dir, "query:", query);

    // tsx/esm — абсолютным file-URL: cwd=tmpdir не имеет node_modules, а этот же
    // execArgv унаследует ext-host subprocess (defaultSpawnArgs).
    const tsxEsm = pathToFileURL(createRequire(import.meta.url).resolve("tsx/esm")).href;

    const port = await freePort();
    const child: ChildProcess = spawn(
        process.execPath,
        [
            "--import",
            tsxEsm,
            MAIN_TS,
            // Открываем ПАПКУ как воркспейс (как `npm start .`), файл откроем вручную
            // через Quick Open — чтобы воспроизвести ровно сценарий пользователя.
            dir,
            `--headless=${String(COLS)}x${String(ROWS)}`,
            `--inspect-tui=127.0.0.1:${String(port)}`,
        ],
        {
            cwd: dir,
            // cwd=tmpdir → tsx иначе подхватит tsconfig.json песочницы (без jsx-настроек)
            // и .tsx упадёт «React is not defined». Форсим репозиторный tsconfig для tsx;
            // tsserver при этом использует свой (ближайший к файлу) tsconfig независимо.
            // VEXX_LSP не задаём: расширение теперь встроено (регистрируется в main.ts).
            env: {
                ...process.env,
                TSX_TSCONFIG_PATH: path.resolve(here, "..", "tsconfig.json"),
            },
            stdio: ["ignore", "ignore", "pipe"],
        },
    );
    let stderr = "";
    child.stderr?.on("data", (c: Buffer) => (stderr += c.toString()));

    const ws = await connectWithRetry(`ws://127.0.0.1:${String(port)}`, 30_000);
    let nextId = 1;
    const pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();
    ws.on("message", (data: WebSocket.RawData) => {
        const res = JSON.parse(data.toString()) as InspectorResponse;
        const w = pending.get(res.id);
        if (w === undefined) return;
        pending.delete(res.id);
        if ("error" in res) w.reject(new Error(res.error.message));
        else w.resolve((res as InspectorSuccessResponse).result);
    });
    const rpc = <T>(method: string, params?: unknown): Promise<T> => {
        const id = nextId++;
        return new Promise<T>((resolve, reject) => {
            pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
            ws.send(JSON.stringify({ id, method, params }));
        });
    };
    const captureFrame = async (): Promise<GridSnapshot> =>
        (await rpc<{ frame: GridSnapshot }>("TUIDom.captureFrame")).frame;

    // Squiggle рисуется как undercurl (StyleFlags.Undercurl === 8) на диапазоне ошибки —
    // детерминированный признак того, что диагностика долетела до редактора.
    const hasSquiggle = (f: GridSnapshot): boolean => f.cells.some((c) => (c.style & 8) !== 0);

    const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

    try {
        // Открыть файл вручную через Quick Open (Ctrl+P → имя → Enter) — как пользователь.
        await sleep(1500); // дать индексу файлов подняться
        await rpc("TUIDom.sendKey", { name: "Ctrl+P" });
        await sleep(400);
        await rpc("TUIDom.sendText", { text: query });
        await sleep(800);
        await rpc("TUIDom.sendKey", { name: "Enter" });
        await sleep(800);

        // Ждать, пока сервер поднимется и опубликует диагностику (squiggle в редакторе).
        const deadline = Date.now() + deadlineMs;
        let frame: GridSnapshot | null = null;
        let ok = false;
        while (Date.now() < deadline) {
            frame = await captureFrame();
            if (hasSquiggle(frame) || /not assignable|assignable to type/i.test(frameToText(frame))) {
                ok = true;
                break;
            }
            await new Promise((r) => setTimeout(r, 500));
        }

        // Дать увидеть текст ошибки: открыть нижнюю панель Problems (Ctrl+J).
        if (ok) {
            await rpc("TUIDom.sendKey", { name: "Ctrl+J" });
            await new Promise((r) => setTimeout(r, 1200));
            frame = await captureFrame();
        }

        if (frame !== null) {
            const out = saveScreenshot("lsp-diagnostics", frame);
            console.log("[lsp-app] screenshot:", out);
            console.log("[lsp-app] --- frame text (tail) ---");
            console.log(
                frameToText(frame)
                    .split("\n")
                    .filter((l) => l.trim() !== "")
                    .slice(-12)
                    .join("\n"),
            );
        }
        console.log(ok ? "[lsp-app] ✅ diagnostics visible" : "[lsp-app] ❌ diagnostics not observed");
        if (!ok && stderr.trim() !== "") console.log("[lsp-app] stderr:\n" + stderr.slice(-2000));
    } finally {
        try {
            await rpc("TUIDom.shutdown");
        } catch {
            /* socket drops as process exits */
        }
        try {
            ws.close();
        } catch {
            /* already closed */
        }
        if (child.exitCode === null) child.kill("SIGKILL");
    }
}

main().then(
    () => process.exit(0),
    (err) => {
        console.error("[lsp-app] FAILED:", err);
        process.exit(1);
    },
);
