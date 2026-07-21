// MCP-сервер машинерии: словарь только про агентов.
//
// Здесь намеренно нет ничего про issue и доску — за задачами агенты ходят в gh сами.
// MCP отвечает на четыре вопроса: кто сейчас работает, запусти вот такую роль,
// останови вон того, покажи чем он занят.
//
// Этот сервер выдаётся ВСЕМ агентам, а не только оркестратору: агент, следящий за своим
// PR, и аналитик — такие же агенты. Потолков в коде нет: ограничения описаны прозой
// в скиллах (осознанное решение, см. план).
import type { IncomingMessage, ServerResponse } from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import type { AgentsConfig } from "./config.ts";
import { append } from "./history.ts";
import { listAgents, readAgentLog } from "./inspect.ts";
import { launch, LaunchError } from "./launch.ts";
import { killWindow } from "./tmux.ts";

function ok(value: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function failed(message: string) {
    return { isError: true, content: [{ type: "text" as const, text: message }] };
}

/**
 * Конфиг передаётся функцией, а не значением: сервер перечитывает config.jsonc, и
 * инструменты обязаны видеть свежие роли без пересоздания сервера.
 */
export function createMcpServer(getConfig: () => AgentsConfig): McpServer {
    const server = new McpServer({ name: "agents", version: "0.2.0" });

    server.registerTool(
        "list_agents",
        {
            title: "Список агентов",
            description:
                "Живые агенты машинерии. key — ключ агента (роль-аргумент), он же имя его worktree. " +
                "status — что докладывает сам claude: busy значит работает, idle значит доделал и ждёт. " +
                "branch — реальная ветка в его дереве. Агент, доделавший работу, не завершается сам: " +
                "он переходит в idle и держит место, пока его не остановят.",
            inputSchema: {},
        },
        async () => ok(await listAgents()),
    );

    server.registerTool(
        "spawn_agent",
        {
            title: "Запустить агента",
            description:
                "Запускает роль. Ключ агента выводится из роли и аргумента (implement + 181 → implement-181), " +
                "задавать его отдельно не нужно. Если такой агент уже запускался, вызов ПРОДОЛЖИТ его прежнюю " +
                "сессию — он помнит весь разговор; это же способ призвать агента обратно. " +
                "`arg` — обычно просто номер задачи: постановку агент прочитает сам.",
            inputSchema: {
                role: z.string().describe("роль из config.jsonc, например implement"),
                arg: z.string().optional().describe("аргумент скилла, например номер issue"),
            },
        },
        async ({ role, arg }) => {
            try {
                const result = await launch(getConfig(), { role, arg, trigger: "mcp", by: "agent" });
                return ok({
                    key: result.key,
                    session: result.session,
                    worktree: result.cwd,
                    mode: result.mode,
                    summary: result.summary,
                    repeatManually: `./agents.sh spawn ${role}${arg ? ` ${arg}` : ""}`,
                });
            } catch (error) {
                if (error instanceof LaunchError) return failed(error.message);
                throw error;
            }
        },
    );

    server.registerTool(
        "stop_agent",
        {
            title: "Остановить агента",
            description:
                "Мягко останавливает агента. Диалог сохраняется, и повторный spawn_agent с тем же ключом " +
                "продолжит его с того же места — поэтому остановка не авария, а штатная операция. " +
                "Останавливай доделавших: сами они не завершаются.",
            inputSchema: { key: z.string().describe("ключ агента из list_agents") },
        },
        async ({ key }) => {
            const agent = (await listAgents()).find(candidate => candidate.key === key);
            if (!agent) return failed(`Агента "${key}" среди живых нет`);
            await killWindow(agent.key);
            append({ at: new Date().toISOString(), kind: "stop", key, by: "agent" });
            return ok({ stopped: key });
        },
    );

    server.registerTool(
        "agent_log",
        {
            title: "Хвост работы агента",
            description:
                "Выжимка последних действий агента: какие инструменты вызывал и с чем. По ней видно, " +
                "долбит ли он одно и то же по кругу или движется.",
            inputSchema: { key: z.string(), limit: z.number().int().positive().max(200).optional() },
        },
        async ({ key, limit }) => {
            const agent = (await listAgents()).find(candidate => candidate.key === key);
            if (!agent) return failed(`Агента "${key}" среди живых нет`);
            return ok({ key, entries: readAgentLog(agent, limit ?? 40) });
        },
    );

    return server;
}

/**
 * Обработчик POST /mcp в stateless-режиме: сервер и транспорт создаются на запрос.
 * Между вызовами ничего не переносится, поэтому рестарт демона не рвёт никаких сессий.
 */
export async function handleMcpRequest(
    request: IncomingMessage,
    response: ServerResponse,
    body: unknown,
    getConfig: () => AgentsConfig,
): Promise<void> {
    const server = createMcpServer(getConfig);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    response.on("close", () => {
        void transport.close();
        void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request, response, body);
}
