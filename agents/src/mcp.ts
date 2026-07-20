// MCP-сервер машинерии: словарь только про агентов.
//
// Здесь намеренно нет ничего про issue, лейблы и доску — оркестратор ходит за задачами
// в `gh` сам. MCP отвечает на три вопроса: кто сейчас работает, запусти вот это, останови вон того.
//
// Второй смысл этого слоя — ошейник. Вместе с `--strict-mcp-config` он определяет, что
// оркестратору вообще доступно: процесс, который в цикле плодит агентов, не должен иметь
// произвольный bash.
import type { IncomingMessage, ServerResponse } from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { AGENT_NAME_RE, checkLimits, listAgents, readAgentLog, skillPrompt, spawnAgent, stopAgent } from "./agents.ts";
import type { AgentsConfig } from "./config.ts";
import { append, readAll } from "./history.ts";

function ok(value: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function failed(message: string) {
    return { isError: true, content: [{ type: "text" as const, text: message }] };
}

/**
 * Конфиг передаётся функцией, а не значением: демон перечитывает config.jsonc на каждом тике,
 * и инструменты обязаны видеть свежие потолки без пересоздания сервера.
 */
export function createMcpServer(getConfig: () => AgentsConfig): McpServer {
    const server = new McpServer({ name: "agents", version: "0.1.0" });

    server.registerTool(
        "list_agents",
        {
            title: "Список агентов",
            description:
                "Живые агенты машинерии. idleMin — минут с последней записи в сессию (эвристика «дышит ли»); " +
                "alive — жив ли процесс; status/state — что докладывает сам claude. " +
                "Агент, доделавший работу, не завершается сам: он переходит в idle и держит слот, пока его не остановят.",
            inputSchema: {},
        },
        async () => ok(await listAgents()),
    );

    server.registerTool(
        "spawn_agent",
        {
            title: "Запустить агента",
            description:
                "Запускает скилл в отдельном git worktree фоновой сессией. `name` — идентификатор агента, " +
                "он же имя worktree (например issue-136). `args` — аргументы скилла одной строкой, " +
                "обычно просто номер задачи: агент разберётся сам. Может вернуть отказ (refused) по потолкам — " +
                "это нормальный ответ, а не ошибка; спорить с ним не надо.",
            inputSchema: {
                name: z.string().regex(AGENT_NAME_RE, "имя должно быть безопасным для пути"),
                role: z.string().describe("роль из config.jsonc, например implement"),
                args: z.string().describe("аргументы скилла, например номер issue"),
            },
        },
        async ({ name, role, args }) => {
            const config = getConfig();
            const roleSpec = config.roles[role];
            if (!roleSpec) {
                return failed(`Неизвестная роль "${role}". Доступны: ${Object.keys(config.roles).join(", ") || "нет ни одной"}`);
            }

            const refusal = checkLimits({
                name,
                running: await listAgents(),
                history: readAll(),
                limits: config.limits,
                dryRun: config.dryRun,
                now: new Date(),
            });
            if (refusal) {
                append({ at: new Date().toISOString(), kind: "spawn-refused", name, skill: roleSpec.skill, reason: refusal.reason });
                return ok(refusal);
            }

            const result = await spawnAgent({ name, skill: roleSpec.skill, args });
            append({ at: new Date().toISOString(), kind: "spawn", name, skill: roleSpec.skill });
            // Отдаём и промпт: по нему видно, чем именно запущен агент, и его можно повторить руками.
            return ok({ ...result, repeatManually: `./agents.sh run ${role} ${args}` });
        },
    );

    server.registerTool(
        "stop_agent",
        {
            title: "Остановить агента",
            description:
                "Мягко останавливает агента и освобождает слот. Диалог сохраняется — агента можно поднять обратно " +
                "(claude attach), поэтому остановка не авария, а штатная операция. Останавливай доделавших: " +
                "сами они слот не отпустят.",
            inputSchema: { name: z.string() },
        },
        async ({ name }) => {
            const agent = (await listAgents()).find(candidate => candidate.name === name);
            if (!agent) return failed(`Агента "${name}" среди живых нет`);
            await stopAgent(agent.agentId);
            append({ at: new Date().toISOString(), kind: "kill", name, agentId: agent.agentId });
            return ok({ stopped: name });
        },
    );

    server.registerTool(
        "agent_log",
        {
            title: "Хвост работы агента",
            description:
                "Выжимка последних действий агента: какие инструменты вызывал и с чем. По ней видно, " +
                "долбит ли он одно и то же по кругу или движется.",
            inputSchema: { name: z.string(), limit: z.number().int().positive().max(200).optional() },
        },
        async ({ name, limit }) => {
            const agent = (await listAgents()).find(candidate => candidate.name === name);
            if (!agent) return failed(`Агента "${name}" среди живых нет`);
            return ok({ name, entries: readAgentLog(agent, limit ?? 40) });
        },
    );

    return server;
}

/**
 * Обработчик POST /mcp в stateless-режиме: сервер и транспорт создаются на запрос.
 * Это ровно та же идея, что и «тик — свежий процесс»: между вызовами ничего не переносится,
 * поэтому рестарт демона не рвёт никаких сессий.
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
