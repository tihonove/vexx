// Демон: тикер + MCP-сервер + витрина в одном процессе.
//
// Он единственный, поэтому он же точка сериализации — потолки и «не два тика разом»
// обеспечиваются тем, что все решения проходят через него, а не флоками.
//
// При этом он НЕ владеет правдой: реестра агентов в памяти нет, счётчик спавнов берётся
// из history.jsonl. Поэтому его перезапуск ничего не восстанавливает — он просто снова
// смотрит на мир. Агенты запущены через --bg и его смерть переживают.
import { spawn } from "node:child_process";
import { createServer } from "node:http";

import { loadConfig } from "./config.ts";
import type { AgentsConfig } from "./config.ts";
import { createDashboard, isStopped } from "./dashboard.ts";
import { append } from "./history.ts";
import { handleMcpRequest } from "./mcp.ts";
import { REPO_ROOT } from "./paths.ts";

const ORCHESTRATE_SKILL = "orchestrate";

let ticking = false;
let lastTickAt: string | undefined;
let wake: (() => void) | undefined;
/** Кнопка на витрине будит сон — чтобы тик в журнале не выглядел плановым, помечаем его здесь. */
let nextTrigger: "schedule" | "manual" = "schedule";

// Конфиг перечитывается на каждом тике: правки лимитов, интервала и dryRun
// подхватываются без рестарта. Рестарт нужен только при смене портов.
let config: AgentsConfig = loadConfig();
const getConfig = () => config;

function log(message: string): void {
    process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
}

/**
 * Тик — свежий процесс claude, который умирает вместе с ответом. Контексту нечего
 * накапливать, компакт невозможен, стоимость тика константна.
 *
 * Ошейник из трёх флагов, и порядок тут важен:
 *   --tools            сужает НАБОР встроенных инструментов (проверено: без него оркестратору
 *                      видны Write, WebFetch, Task* и прочее — --allowedTools их не убирает,
 *                      он раздаёт только разрешения);
 *   --strict-mcp-config пускает единственный MCP-сервер — наш;
 *   --allowedTools      снимает вопросы о разрешениях, иначе headless-запуск повиснет.
 * В сумме: чтение репозитория, gh и четыре наших инструмента. Ни правок файлов, ни сети.
 */
function runOrchestrator(mcpPort: number): Promise<{ ok: boolean; summary: string }> {
    const mcpConfig = JSON.stringify({
        mcpServers: { agents: { type: "http", url: `http://127.0.0.1:${mcpPort}/mcp` } },
    });
    const args = [
        "-p",
        `/${ORCHESTRATE_SKILL}`,
        "--mcp-config",
        mcpConfig,
        "--strict-mcp-config",
        "--tools",
        "Bash Read Glob Grep",
        "--allowedTools",
        [
            "mcp__agents__list_agents",
            "mcp__agents__spawn_agent",
            "mcp__agents__stop_agent",
            "mcp__agents__agent_log",
            "Bash(gh *)",
            "Bash(node agents/bin/status.mjs*)",
            "Read",
            "Glob",
            "Grep",
        ].join(" "),
        "--output-format",
        "json",
    ];

    return new Promise(resolve => {
        // stdin закрыт: иначе claude -p ждёт данных и висит.
        const child = spawn("claude", args, { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", chunk => (stdout += chunk));
        child.stderr.on("data", chunk => (stderr += chunk));
        child.on("error", error => resolve({ ok: false, summary: `не удалось запустить claude: ${error.message}` }));
        child.on("close", code => {
            if (code !== 0) {
                resolve({ ok: false, summary: (stderr.trim() || `claude завершился с кодом ${code}`).slice(0, 2000) });
                return;
            }
            try {
                const parsed = JSON.parse(stdout) as { result?: string; is_error?: boolean };
                resolve({ ok: !parsed.is_error, summary: (parsed.result ?? "").slice(0, 2000) });
            } catch {
                resolve({ ok: true, summary: stdout.trim().slice(0, 2000) });
            }
        });
    });
}

async function tick(trigger: "schedule" | "manual"): Promise<void> {
    if (ticking) return;
    ticking = true;
    const startedAt = Date.now();
    try {
        config = loadConfig();
        append({ at: new Date().toISOString(), kind: "tick-start", trigger });
        log(`тик (${trigger})${config.dryRun ? " · dry-run" : ""}`);
        const result = await runOrchestrator(config.ports.mcp);
        append({
            at: new Date().toISOString(),
            kind: "tick-end",
            ok: result.ok,
            summary: result.summary,
            durationMs: Date.now() - startedAt,
        });
        log(`итог: ${result.summary.split("\n")[0] || "(пусто)"}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        append({ at: new Date().toISOString(), kind: "error", message });
        log(`ошибка тика: ${message}`);
    } finally {
        ticking = false;
        lastTickAt = new Date().toISOString();
    }
}

/** Сон, который можно прервать кнопкой «Тик сейчас». */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            wake = undefined;
            resolve();
        }, ms);
        wake = () => {
            clearTimeout(timer);
            wake = undefined;
            resolve();
        };
    });
}

async function loop(): Promise<void> {
    for (;;) {
        // STOP проверяется здесь, а не внутри скилла: останавливать луп, который в этот
        // момент спавнит процессы, — гонка, а файл-стоп её не создаёт.
        const trigger = nextTrigger;
        nextTrigger = "schedule";
        if (isStopped()) log("STOP — тик пропущен");
        else await tick(trigger);
        await sleep(config.limits.tickIntervalMin * 60_000);
    }
}

function readBody(request: import("node:http").IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let raw = "";
        request.on("data", chunk => (raw += chunk));
        request.on("end", () => {
            if (raw.length === 0) {
                resolve(undefined);
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch (error) {
                reject(error);
            }
        });
        request.on("error", reject);
    });
}

function main(): void {
    const { dashboard: dashboardPort, mcp: mcpPort } = config.ports;

    createDashboard({
        getConfig,
        isTicking: () => ticking,
        lastTickAt: () => lastTickAt,
        requestTick: () => {
            if (ticking) return false;
            nextTrigger = "manual";
            // Если цикл спит — будим его; если между тиками, он и так вот-вот заберёт trigger.
            wake?.();
            return true;
        },
    }).listen(dashboardPort, () => log(`витрина: http://127.0.0.1:${dashboardPort}`));

    // MCP слушает только loopback: он нужен процессу claude внутри контейнера и никому больше.
    createServer((request, response) => {
        void (async () => {
            if (request.method !== "POST" || !(request.url ?? "").startsWith("/mcp")) {
                response.writeHead(404).end();
                return;
            }
            try {
                await handleMcpRequest(request, response, await readBody(request), getConfig);
            } catch (error) {
                if (!response.headersSent) response.writeHead(500);
                response.end(String(error));
            }
        })();
    }).listen(mcpPort, "127.0.0.1", () => log(`MCP: http://127.0.0.1:${mcpPort}/mcp`));

    log(`интервал ${config.limits.tickIntervalMin} мин, потолок ${config.limits.maxConcurrent} агентов`);
    void loop();
}

main();
