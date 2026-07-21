// Сервер машинерии: планировщик + MCP + витрина в одном процессе.
//
// Никакой «оркестрации» в коде нет. Планировщик тупой: у роли есть everyMin — значит
// раз в N минут запусти её через тот же launch(), которым пользуются MCP и CLI.
// Оркестратор — обычная роль, просто с расписанием.
//
// Сервер не владеет правдой: агенты запущены с --background и его смерть переживают,
// а состояние выводится из мира заново. Рестарт ничего не восстанавливает — он просто
// снова смотрит.
import { createServer, type IncomingMessage } from "node:http";

import { type AgentsConfig, loadConfig } from "./config.ts";
import { createDashboard, isStopped } from "./dashboard.ts";
import { refreshMain } from "./git.ts";
import { append } from "./history.ts";
import { launch } from "./launch.ts";
import { handleMcpRequest } from "./mcp.ts";

let config: AgentsConfig = loadConfig();
const getConfig = () => config;

/** Роли, чей запуск сейчас идёт. Не даём накладывать второй запуск той же роли на первый. */
const running = new Set<string>();

function log(message: string): void {
    process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
}

async function runRole(role: string, trigger: "schedule" | "dashboard"): Promise<void> {
    if (running.has(role)) return;
    running.add(role);
    try {
        // Конфиг перечитывается перед каждым запуском: правки ролей подхватываются
        // без рестарта. Рестарт нужен только при смене портов.
        config = loadConfig();
        const result = await launch(config, { role, trigger, by: "human" });
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
 * По таймеру на роль. Отдельный таймер вместо общего цикла — потому что роли независимы:
 * долгий тик оркестратора не должен сдвигать расписание остальных.
 */
function schedule(role: string, everyMin: number): void {
    setInterval(() => {
        // STOP проверяется здесь, а не внутри скилла: останавливать процесс, который в этот
        // момент плодит агентов, — гонка, а файл-стоп её не создаёт.
        if (isStopped()) {
            log(`STOP — ${role} пропущен`);
            return;
        }
        void runRole(role, "schedule");
    }, everyMin * 60_000);
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
    const { dashboard: dashboardPort, mcp: mcpPort } = config.ports;

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

    const scheduled = Object.entries(config.roles).filter(([, spec]) => spec.everyMin);
    for (const [role, spec] of scheduled) schedule(role, spec.everyMin as number);
    log(
        scheduled.length > 0
            ? `по расписанию: ${scheduled.map(([role, spec]) => `${role} раз в ${spec.everyMin}м`).join(", ")}`
            : "ролей по расписанию нет — только по требованию",
    );
    if (isStopped()) log("режим: STOP — по расписанию ничего не запускается");
}

main();
