// Сервер машинерии: планировщик + MCP + витрина в одном процессе.
//
// Никакой «оркестрации» в коде нет. Планировщик тупой: у роли есть everyMin — значит
// раз в N минут запусти её через тот же launch(), которым пользуются MCP и CLI.
// Оркестратор — обычная роль, просто с расписанием.
//
// Конфиг в памяти НЕ хранится: он перечитывается с диска на каждом обращении — витрина,
// MCP, планировщик все видят config.jsonc «на горячую». Поменял роль, everyMin или список
// ролей — эффект сразу, без рестарта. Рестарт нужен только под смену портов: сокеты
// биндятся на старте.
//
// Сервер не владеет и правдой о мире: агенты живут в tmux и его смерть переживают, а их
// состояние выводится заново. Рестарт ничего не восстанавливает — он просто снова смотрит.
import { createServer, type IncomingMessage } from "node:http";

import { type AgentsConfig, ConfigError, loadConfig } from "./config.ts";
import { createDashboard, isStopped } from "./dashboard.ts";
import { refreshMain } from "./git.ts";
import { append } from "./history.ts";
import { launch } from "./launch.ts";
import { handleMcpRequest } from "./mcp.ts";

// Единственный доступ к конфигу — свежее чтение с диска. Никакого кэша: в этом весь смысл.
const getConfig = (): AgentsConfig => loadConfig();

/** Роли, чей запуск сейчас идёт. Не даём накладывать второй запуск той же роли на первый. */
const running = new Set<string>();

function log(message: string): void {
    process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
}

async function runRole(role: string, trigger: "schedule" | "dashboard"): Promise<void> {
    if (running.has(role)) return;
    running.add(role);
    try {
        const result = await launch(getConfig(), { role, trigger, by: "human" });
        log(`${role} (${trigger}): ${result.summary?.split("\n")[0] ?? "запущен фоном"}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        append({ at: new Date().toISOString(), kind: "error", message, key: role });
        log(`ошибка запуска ${role}: ${message}`);
    } finally {
        running.delete(role);
    }
}

/**
 * Свежесть main — по таймеру, а не перед каждым запуском. Дерево агенту отводит сам claude
 * от локального main, поэтому устаревший main = агент работает на вчерашней базе. Ошибка
 * здесь не фатальна: сеть могла лечь, и это не повод не запускать агента.
 */
const PULL_EVERY_MIN = 10;

async function pullMain(): Promise<void> {
    const state = await refreshMain();
    const ahead = state.ahead > 0 ? ` · непушенных коммитов: ${state.ahead}` : "";
    log(`main: ${state.base}${ahead}${state.note ? ` · ${state.note}` : ""}`);
}

/**
 * Один общий тикер расписания вместо таймера-на-роль. Так планировщик тоже работает на
 * горячую: config.jsonc перечитывается каждый проход, и новая роль с everyMin, изменённый
 * интервал или снятая роль подхватываются сами. За каждой ролью держим момент, от которого
 * отсчитываем её интервал (`dueSince`).
 */
const SCHED_GRANULARITY_MS = 60_000;
const dueSince = new Map<string, number>();

function scheduleTick(): void {
    let config: AgentsConfig;
    try {
        config = loadConfig();
    } catch (error) {
        // Битый конфиг (например, недосохранённый редактором) — не роняем сервер и не
        // спавним по устаревшим данным: пропускаем проход, следующий подхватит исправленный.
        log(`конфиг не читается, расписание на паузе: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
        return;
    }

    const now = Date.now();
    const scheduled = new Set<string>();
    for (const [role, spec] of Object.entries(config.roles)) {
        if (!spec.everyMin) continue;
        scheduled.add(role);

        const since = dueSince.get(role);
        // Роль впервые попала в расписание — начинаем отсчёт, но сразу не запускаем:
        // первый прогон будет через everyMin, как и раньше.
        if (since === undefined) {
            dueSince.set(role, now);
            continue;
        }
        if (now - since < spec.everyMin * 60_000) continue;

        dueSince.set(role, now);
        // STOP проверяется здесь, а не в скилле: тормозить процесс, который в этот момент
        // плодит агентов, — гонка, а файл-стоп её не создаёт.
        if (isStopped()) {
            log(`STOP — ${role} пропущен`);
            continue;
        }
        void runRole(role, "schedule");
    }

    // Роль убрали из расписания — забываем её отсчёт, чтобы вернувшись, она начала заново.
    for (const role of [...dueSince.keys()]) if (!scheduled.has(role)) dueSince.delete(role);
}

function readBody(request: IncomingMessage): Promise<unknown> {
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
    // Порты читаются один раз: сокеты биндятся на старте, их смена требует рестарта.
    // Всё остальное в конфиге — на горячую.
    const { dashboard: dashboardPort, mcp: mcpPort } = loadConfig().ports;

    createDashboard({
        getConfig,
        running: () => [...running],
        requestRun: role => {
            if (running.has(role)) return false;
            void runRole(role, "dashboard");
            return true;
        },
    }).listen(dashboardPort, () => log(`витрина: http://127.0.0.1:${dashboardPort}`));

    // MCP слушает только loopback: он нужен процессам claude внутри контейнера и никому больше.
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

    void pullMain();
    setInterval(() => void pullMain(), PULL_EVERY_MIN * 60_000);

    setInterval(scheduleTick, SCHED_GRANULARITY_MS);
    log("конфиг перечитывается на горячую; расписание проверяется раз в минуту");
    if (isStopped()) log("режим: STOP — по расписанию ничего не запускается");
}

main();
