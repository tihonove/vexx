// Отладка скилла в одиночку: форграунд, без демона, без потолков, без GitHub.
//
// Это главный инструмент разработки скиллов. Задача пишется руками в JSON-файл, скилл
// получает ровно тот же вход, что и в проде, — потому что он в принципе не умеет получать
// его иначе. Что отладили здесь, то и поедет.
//
//   run implement .agents-runs/tasks/my-test.json   — скилл агента в своём worktree
//   run orchestrate                                 — один тик оркестратора, как у демона
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { loadConfig } from "./config.ts";
import { UserError } from "./gh.ts";
import { REPO_ROOT } from "./paths.ts";
import { readTaskFile, writeTaskFile } from "./task.ts";

const USAGE = `Использование: run <роль|orchestrate> [файл-задачи.json] [--worktree <имя>]

  run orchestrate                       один тик оркестратора в форграунде
  run implement task.json               запустить роль implement с этой задачей
  run implement task.json --worktree t1 имя worktree (по умолчанию — id из задачи)
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
    let worktree: string | undefined;
    for (let index = 0; index < argv.length; index++) {
        if (argv[index] === "--worktree") {
            worktree = argv[++index];
            if (!worktree) throw new UserError("--worktree требует имя");
            continue;
        }
        if (argv[index] === "--help" || argv[index] === "-h") throw new UserError(USAGE, 0);
        positional.push(argv[index]!);
    }

    const [target, taskFileArg] = positional;
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
                "mcp__agents__list_agents mcp__agents__spawn_agent mcp__agents__stop_agent mcp__agents__agent_log Bash(gh *) Read Glob Grep",
            ],
            "orchestrate",
        );
    }

    const role = config.roles[target];
    if (!role) {
        throw new UserError(`Неизвестная роль "${target}". В config.jsonc объявлены: ${Object.keys(config.roles).join(", ") || "нет ни одной"}`);
    }
    if (!taskFileArg) throw new UserError(`Роли "${target}" нужен файл задачи.\n\n${USAGE}`);

    // Путь к задаче может прийти относительно корня репо (так его набирают в ./agents.sh),
    // а мы запускаемся из agents/ — поэтому пробуем оба варианта.
    const candidates = [resolve(taskFileArg), resolve(REPO_ROOT, taskFileArg)];
    const found = candidates.find(path => existsSync(path));
    if (!found) throw new UserError(`Файл задачи не найден: ${taskFileArg}`);
    const task = readTaskFile(found);
    const name = worktree ?? task.id;
    // Перекладываем задачу в свой каталог под именем worktree — как это делает spawn_agent,
    // чтобы путь и содержимое совпадали с боевым запуском.
    const taskFile = writeTaskFile({ ...task, id: name });

    console.log(`Роль: ${target} · скилл: /${role.skill} · worktree: ${name}\n`);
    return passthrough(["--worktree", name, "--permission-mode", "acceptEdits", `/${role.skill} ${taskFile}`], target);
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
