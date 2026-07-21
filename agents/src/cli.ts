// Ручной запуск ролей — тем же кодом, что и в проде.
//
// Отладка скилла в одиночку: `run` показывает диалог целиком, `spawn` уводит агента в фон.
// Разницы в сборке команды нет — она вся описана ролью, поэтому отлаживается ровно то,
// что потом поедет по расписанию.
import { ConfigError, loadConfig } from "./config.ts";
import { launch, LaunchError } from "./launch.ts";
import { listAgents } from "./inspect.ts";
import { killWindow } from "./tmux.ts";
import { append } from "./history.ts";

const USAGE = `Использование: agents.sh <команда>

  run <роль> [аргумент]     форграунд, живой диалог — отладка скилла руками
  spawn <роль> [аргумент]   фоном, как по расписанию
  wake <роль> <аргумент>    синоним spawn: тот же ключ → продолжение той же сессии
  list                      живые агенты
  stop-agent <ключ>         остановить агента
`;

async function main(argv: string[]): Promise<number> {
    const [command, role, ...rest] = argv;
    const arg = rest.join(" ").trim();

    if (command === "list") {
        const agents = await listAgents();
        if (agents.length === 0) {
            console.log("Живых агентов нет");
            return 0;
        }
        for (const agent of agents) {
            console.log(
                `${agent.key}  ${agent.status ?? "—"}${agent.state ? `/${agent.state}` : ""}  ` +
                    `возраст ${agent.ageMin}м  ${agent.branch ?? "—"}`,
            );
        }
        return 0;
    }

    if (command === "stop-agent") {
        if (!role) throw new LaunchError(`stop-agent требует ключ агента.\n\n${USAGE}`);
        const agent = (await listAgents()).find(candidate => candidate.key === role);
        if (!agent) throw new LaunchError(`Агента "${role}" среди живых нет`);
        await killWindow(agent.key);
        append({ at: new Date().toISOString(), kind: "stop", key: role, by: "human" });
        console.log(`Остановлен ${role}`);
        return 0;
    }

    if (command !== "run" && command !== "spawn" && command !== "wake") {
        console.error(USAGE);
        return 2;
    }
    if (!role) throw new LaunchError(`${command} требует имя роли.\n\n${USAGE}`);

    const config = loadConfig();
    const result = await launch(config, { role, arg, trigger: "cli", by: "human", inherit: command === "run" });

    if (command === "run") return result.ok ? 0 : 1;

    const how =
        result.session === "resume"
            ? "продолжена прежняя сессия — агент помнит разговор"
            : result.session === "create"
              ? "заведена новая сессия"
              : "разовый запуск без памяти";
    console.log(`${result.key}: ${how}`);
    console.log(`worktree: ${result.cwd}`);
    if (result.summary) console.log(result.summary);
    return result.ok ? 0 : 1;
}

main(process.argv.slice(2)).then(
    code => process.exit(code),
    (error: unknown) => {
        if (error instanceof LaunchError || error instanceof ConfigError) {
            console.error(error.message);
            process.exit(1);
        }
        console.error(error);
        process.exit(1);
    },
);
