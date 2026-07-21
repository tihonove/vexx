// Единственный путь запуска агента. Через него идут планировщик, MCP и CLI — других
// способов запустить агента в системе нет, и именно поэтому здесь же пишется журнал.
//
// Все роли запускаются ОДНИМ кодом: различия между оркестратором и реализатором целиком
// описаны полями роли в config.jsonc. Раньше их запускали два разных куска кода с двумя
// разными наборами флагов — и ломались они по-разному.
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";

import type { AgentsConfig, RoleSpec } from "./config.ts";
import { agentKey, findSession } from "./keys.ts";
import { append, type SessionAction, type Trigger } from "./history.ts";
import { REPO_ROOT, worktreePath } from "./paths.ts";

export class LaunchError extends Error {}

export interface LaunchPlan {
    key: string;
    role: string;
    arg: string;
    cwd: string;
    args: string[];
    session: SessionAction;
    background: boolean;
}

export interface LaunchResult extends LaunchPlan {
    cmd: string;
    base?: string;
    /** Есть только у форграундных запусков: фоновый отсоединяется и итога не отдаёт. */
    summary?: string;
    ok: boolean;
}

function run(command: string, args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(command, args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) reject(new Error(`${command} ${args.join(" ")}: ${stderr.trim() || error.message}`));
            else resolve(stdout);
        });
    });
}

export function skillPrompt(skill: string, arg: string): string {
    return `/${skill}${arg.trim() ? ` ${arg.trim()}` : ""}`;
}

/**
 * Сборка командной строки — чистая функция, потому что это самое ценное место для тестов:
 * ошибка во флагах не падает, а тихо снимает ошейник или теряет память агента.
 */
export function buildLaunch(args: {
    role: string;
    spec: RoleSpec;
    arg: string;
    mcpPort: number;
    /** Найденная прежняя сессия — если роль умеет resume. */
    sessionId?: string;
    /** Отладка руками: живой диалог в терминале вместо -p и фонового режима. */
    interactive?: boolean;
}): LaunchPlan {
    const key = agentKey(args.role, args.arg);
    const cwd = args.spec.worktree ? worktreePath(key) : REPO_ROOT;

    const argv: string[] = [];

    // MCP получают ВСЕ роли без исключения: агент, следящий за своим PR, и аналитик —
    // такие же агенты, и им нужен тот же словарь, что и оркестратору.
    argv.push(
        "--mcp-config",
        JSON.stringify({ mcpServers: { agents: { type: "http", url: `http://127.0.0.1:${args.mcpPort}/mcp` } } }),
        "--strict-mcp-config",
    );

    // --tools сужает НАБОР встроенных инструментов, --allowedTools раздаёт лишь разрешения.
    // Проверено на прошлой версии: без --tools оркестратору были видны Write, WebFetch и Task*.
    if (args.spec.tools && args.spec.tools !== "default") argv.push("--tools", args.spec.tools);
    if (args.spec.allow?.length) argv.push("--allowedTools", args.spec.allow.join(" "));
    if (args.spec.permissionMode) argv.push("--permission-mode", args.spec.permissionMode);

    // Флага --worktree здесь нет намеренно: дерево заводит prepareWorktree(), потому что
    // claude отвёл бы его от origin/main и не увидел бы наших локальных коммитов.
    // Агент просто запускается с cwd внутри готового дерева.

    let session: SessionAction = "fresh";
    if (args.spec.resume) {
        if (args.sessionId) {
            argv.push("--resume", args.sessionId);
            session = "resume";
        } else {
            session = "create";
        }
    }

    // Интерактивный режим — это отладка человеком: ни фона, ни -p, диалог виден целиком.
    const background = args.spec.background && !args.interactive;
    if (background) argv.push("--background");
    else if (!args.interactive) argv.push("-p", "--output-format", "json");

    argv.push(skillPrompt(args.spec.skill, args.arg));

    return { key, role: args.role, arg: args.arg, cwd, args: argv, session, background };
}

/** Ветка агента. Своё пространство имён, чтобы она не путалась с ветками человека. */
export function agentBranch(key: string): string {
    return `agent/${key}`;
}

/**
 * Завести агенту дерево от ЛОКАЛЬНОГО `main`.
 *
 * Делаем это сами, а не флагом `claude --worktree`, из-за проверенного факта: тот отводит
 * дерево от `origin/main`. Разница не косметическая — из-за неё до агента не доезжали
 * закоммиченные, но не запушенные скиллы, и он встречал `Unknown command: /probe`.
 * Свой `git worktree add` заодно не запирает дерево, так что убирается оно обычным
 * `git worktree remove`, без двух `-f`.
 *
 * `fetch` делаем попыткой: сеть может быть недоступна (в devcontainer remote по SSH,
 * а ключа нет), и это не повод не запускать агента — просто база будет вчерашней.
 */
export async function prepareWorktree(key: string, path: string): Promise<string> {
    let fetched = "";
    try {
        await run("git", ["-C", REPO_ROOT, "fetch", "origin", "main"]);
        const head = (await run("git", ["-C", REPO_ROOT, "rev-parse", "--abbrev-ref", "HEAD"])).trim();
        // Двигаем только вперёд: git сам откажется, если это затрёт правки.
        if (head === "main") await run("git", ["-C", REPO_ROOT, "merge", "--ff-only", "origin/main"]);
        else await run("git", ["-C", REPO_ROOT, "fetch", "origin", "main:main"]);
    } catch (error) {
        fetched = ` (origin недоступен: ${error instanceof Error ? error.message.split("\n")[0].slice(0, 80) : ""})`;
    }

    await run("git", ["-C", REPO_ROOT, "worktree", "add", "-b", agentBranch(key), path, "main"]);
    const base = (await run("git", ["-C", REPO_ROOT, "rev-parse", "--short", "main"])).trim();

    let ahead = 0;
    try {
        ahead = Number((await run("git", ["-C", REPO_ROOT, "rev-list", "--count", "origin/main..main"])).trim());
    } catch {
        // origin/main может отсутствовать — тогда и сравнивать не с чем.
    }
    // Непушенные коммиты main попадут в ветку агента и будут выглядеть в PR как его работа.
    const warning = ahead > 0 ? ` (локальный main опережает origin на ${ahead} — они попадут в PR агента)` : "";
    return `${base}${warning}${fetched}`;
}

export interface LaunchRequest {
    role: string;
    arg?: string;
    trigger: Trigger;
    /** Кто дёрнул: роль-инициатор или "human". Видно в журнале. */
    by: string;
    /** Форграундный запуск с выводом прямо в терминал — для отладки скилла руками. */
    inherit?: boolean;
}

export async function launch(config: AgentsConfig, request: LaunchRequest): Promise<LaunchResult> {
    const spec = config.roles[request.role];
    if (!spec) {
        const known = Object.keys(config.roles).join(", ");
        throw new LaunchError(`Неизвестная роль "${request.role}". Есть: ${known}`);
    }

    const arg = (request.arg ?? "").trim();
    const key = agentKey(request.role, arg);
    const cwd = spec.worktree ? worktreePath(key) : REPO_ROOT;
    const worktreeExists = spec.worktree && existsSync(cwd);

    // Create-or-update: выбора между «создать» и «продолжить» у вызывающего нет и не должно
    // быть. Он называет роль и аргумент, а есть ли уже такая сессия — дело этого модуля.
    const sessionId = spec.resume && worktreeExists ? findSession(cwd) : undefined;

    const plan = buildLaunch({
        role: request.role,
        spec,
        arg,
        mcpPort: config.ports.mcp,
        sessionId,
        interactive: request.inherit,
    });
    const base = spec.worktree && !worktreeExists ? await prepareWorktree(key, cwd) : undefined;

    const cmd = `claude ${plan.args.join(" ")}`;
    append({
        at: new Date().toISOString(),
        kind: "launch",
        role: plan.role,
        arg: plan.arg,
        key: plan.key,
        session: plan.session,
        trigger: request.trigger,
        by: request.by,
        cwd: plan.cwd,
        base,
        cmd,
    });

    // К этому моменту дерево уже есть: его завёл prepareWorktree выше.
    const startedAt = Date.now();

    if (request.inherit) {
        const code = await runInherit(plan.args, plan.cwd);
        return { ...plan, cmd, base, ok: code === 0, summary: `код выхода ${code}` };
    }

    const finished = await runCaptured(plan.args, plan.cwd);
    if (!plan.background) {
        append({
            at: new Date().toISOString(),
            kind: "finish",
            key: plan.key,
            ok: finished.ok,
            durationMs: Date.now() - startedAt,
            summary: finished.summary,
        });
    }
    return { ...plan, cmd, base, ok: finished.ok, summary: finished.summary };
}

function runCaptured(args: string[], cwd: string): Promise<{ ok: boolean; summary: string }> {
    return new Promise(resolve => {
        // stdin закрыт: иначе claude -p ждёт данных и висит.
        const child = spawn("claude", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
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

function runInherit(args: string[], cwd: string): Promise<number> {
    return new Promise(resolve => {
        const child = spawn("claude", args, { cwd, stdio: "inherit" });
        child.on("close", code => resolve(code ?? 1));
        child.on("error", () => resolve(1));
    });
}
