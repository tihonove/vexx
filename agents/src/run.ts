// Отладка скилла в одиночку: форграунд, без демона, без потолков.
//
// Запуск руками и запуск оркестратором — это одна и та же команда с одним и тем же
// аргументом: `spawn_agent` делает ровно `/<скилл> <аргументы>`, и здесь то же самое.
// Поэтому всё, что делает машинерия, вы можете повторить сами и посмотреть глазами.
//
//   run implement 136    — реализатор по задаче 136
//   run orchestrate      — один тик оркестратора, как у демона
import { spawn } from "node:child_process";

import { skillPrompt } from "./agents.ts";
import { loadConfig } from "./config.ts";
import { UserError } from "./gh.ts";
import { REPO_ROOT } from "./paths.ts";

const USAGE = `Использование: run <роль|orchestrate> [аргументы скилла] [--worktree <имя>] [--here]

  run orchestrate                один тик оркестратора в форграунде
  run implement 136              как в проде: в отдельном worktree (implement-136)
  run implement 136 --worktree t1  то же, но с явным именем worktree
  run implement 136 --here       в текущем рабочем дереве — см. предупреждение ниже

--here нужен только для отладки самого скилла: worktree создаётся от main, поэтому
незакоммиченный .claude/skills/* агент в нём не увидит. Ценой этого агент работает
в вашем каталоге и может переключить вам ветку — держите его на коротком поводке.
`;

function passthrough(args: string[], label: string): Promise<number> {
    console.log(`$ claude ${args.map(arg => (arg.includes(" ") ? JSON.stringify(arg) : arg)).join(" ")}\n`);
    return new Promise(resolve => {
        const child = spawn("claude", args, { cwd: REPO_ROOT, stdio: ["ignore", "inherit", "inherit"] });
        child.on("error", error => {
            console.error(`${label}: ${error.message}`);
            resolve(1);
        });
        child.on("close", code => resolve(code ?? 1));
    });
}

async function main(argv: string[]): Promise<number> {
    const positional: string[] = [];
    // Изоляция по умолчанию: агент не должен трогать рабочий каталог человека.
    let isolate = true;
    let worktree: string | undefined;
    for (let index = 0; index < argv.length; index++) {
        if (argv[index] === "--here") {
            isolate = false;
            continue;
        }
        if (argv[index] === "--worktree") {
            isolate = true;
            const next = argv[index + 1];
            if (next && !next.startsWith("-")) {
                worktree = next;
                index++;
            }
            continue;
        }
        if (argv[index] === "--help" || argv[index] === "-h") throw new UserError(USAGE, 0);
        positional.push(argv[index]!);
    }

    const [target, ...skillArgs] = positional;
    if (!target) throw new UserError(USAGE);
    const config = loadConfig();

    if (target === "orchestrate") {
        // Тот же ошейник, что у демона, — иначе отлаживали бы не то, что работает в проде.
        const mcpConfig = JSON.stringify({
            mcpServers: { agents: { type: "http", url: `http://127.0.0.1:${config.ports.mcp}/mcp` } },
        });
        console.log("Оркестратору нужен живой демон (./agents.sh start) — он держит MCP-сервер.\n");
        return passthrough(
            [
                "-p",
                "/orchestrate",
                "--mcp-config",
                mcpConfig,
                "--strict-mcp-config",
                "--tools",
                "Bash Read Glob Grep",
                "--allowedTools",
                "mcp__agents__list_agents mcp__agents__spawn_agent mcp__agents__stop_agent mcp__agents__agent_log Bash(gh *) Bash(node agents/bin/status.mjs*) Read Glob Grep",
            ],
            "orchestrate",
        );
    }

    const role = config.roles[target];
    if (!role) {
        throw new UserError(`Неизвестная роль "${target}". В config.jsonc объявлены: ${Object.keys(config.roles).join(", ") || "нет ни одной"}`);
    }
    if (skillArgs.length === 0) throw new UserError(`Роли "${target}" нужен аргумент — номер задачи.\n\n${USAGE}`);

    // Тот же промпт, что собирает spawn_agent: запуск руками и запуск машинерией совпадают.
    const prompt = skillPrompt(role.skill, skillArgs.join(" "));
    // Без --worktree имя не нужно; с ним по умолчанию берём его из аргументов.
    const name = worktree ?? `${target}-${skillArgs.join("-").replace(/[^a-zA-Z0-9._-]/g, "-")}`;

    const args = ["--permission-mode", "acceptEdits", prompt];
    if (isolate) {
        args.unshift("--worktree", name);
        console.log(`Роль: ${target} · ${prompt} · worktree: ${name}`);
        console.log("Worktree отводится от main — незакоммиченные правки скилла агент не увидит.\n");
    } else {
        console.log(`Роль: ${target} · ${prompt} · ЗДЕСЬ ЖЕ: ${REPO_ROOT}`);
        console.log("Внимание: агент работает в вашем рабочем каталоге и может переключить ветку.\n");
    }
    return passthrough(args, target);
}

main(process.argv.slice(2)).then(
    code => process.exit(code),
    (error: unknown) => {
        if (error instanceof UserError) {
            console.error(error.message);
            process.exit(error.exitCode);
        }
        console.error(error);
        process.exit(1);
    },
);
