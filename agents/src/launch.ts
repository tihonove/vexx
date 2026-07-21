// Единственный путь запуска агента. Через него идут планировщик, MCP и CLI — других
// способов запустить агента в системе нет, и именно поэтому здесь же пишется журнал.
//
// Все роли запускаются ОДНИМ кодом: различия между оркестратором и реализатором целиком
// описаны полями роли в config.jsonc. Раньше их запускали два разных куска кода с двумя
// разными наборами флагов — и ломались они по-разному.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import type { AgentsConfig, RoleSpec } from "./config.ts";
import { append, type SessionAction, type Trigger } from "./history.ts";
import { agentKey, uuidFromKey } from "./keys.ts";
import { REPO_ROOT, worktreePath } from "./paths.ts";
import { listAgentWindows, openWindow, shellQuote } from "./tmux.ts";

export class LaunchError extends Error {}

export interface LaunchPlan {
    key: string;
    role: string;
    arg: string;
    /** Рабочий каталог агента. При создании дерева — корень: дерева ещё нет. */
    cwd: string;
    args: string[];
    session: SessionAction;
    mode: RoleSpec["mode"];
}

export interface LaunchResult extends LaunchPlan {
    cmd: string;
    /** Есть только у oneshot: долгоживущий агент итога не отдаёт, он продолжает жить. */
    summary?: string;
    ok: boolean;
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
    /** Дерево уже есть — значит агент уже запускался, и его сессию надо продолжить. */
    worktreeExists: boolean;
}): LaunchPlan {
    const key = agentKey(args.role, args.arg);
    const needsWorktree = args.spec.worktree && !args.worktreeExists;
    // Дерево создаёт сам claude флагом --worktree, а он умеет это только из корня репозитория.
    const cwd = !args.spec.worktree || needsWorktree ? REPO_ROOT : worktreePath(key);

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

    if (needsWorktree) argv.push("--worktree", key);

    // Create-or-update по сессии. Работает только в режиме session: id можно задать лишь
    // интерактивному claude, `--bg` его игнорирует, а `-p` живёт один вызов.
    let session: SessionAction = "fresh";
    if (args.spec.mode === "session") {
        const uuid = uuidFromKey(key);
        argv.push(args.worktreeExists ? "--resume" : "--session-id", uuid);
        session = args.worktreeExists ? "resume" : "create";
    } else {
        argv.push("-p", "--output-format", "json");
    }

    argv.push(skillPrompt(args.spec.skill, args.arg));

    return { key, role: args.role, arg: args.arg, cwd, args: argv, session, mode: args.spec.mode };
}

export interface LaunchRequest {
    role: string;
    arg?: string;
    trigger: Trigger;
    /** Кто дёрнул: роль-инициатор или "human". Видно в журнале. */
    by: string;
    /** Отладка руками: показать диалог прямо в терминале вместо окна tmux. */
    inherit?: boolean;
}

export async function launch(config: AgentsConfig, request: LaunchRequest): Promise<LaunchResult> {
    const spec = config.roles[request.role];
    if (!spec) {
        throw new LaunchError(`Неизвестная роль "${request.role}". Есть: ${Object.keys(config.roles).join(", ")}`);
    }

    const arg = (request.arg ?? "").trim();
    const key = agentKey(request.role, arg);

    // Агент уже работает — значит его сессия сейчас открыта в его окне, и «продолжить» её
    // вторым процессом нельзя: получилось бы два окна с одним именем и два claude на одну
    // сессию. Отказ здесь честнее молчаливого дубля.
    if (spec.mode === "session" && !request.inherit && (await listAgentWindows()).some(window => window.name === key)) {
        throw new LaunchError(`Агент "${key}" уже работает. Посмотреть — ./agents.sh watch ${key}, остановить — stop-agent ${key}`);
    }

    const worktreeExists = spec.worktree && existsSync(worktreePath(key));

    const plan = buildLaunch({ role: request.role, spec, arg, mcpPort: config.ports.mcp, worktreeExists });
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
        cmd,
    });

    if (request.inherit) {
        const code = await runInherit(plan.args, plan.cwd);
        return { ...plan, cmd, ok: code === 0, summary: `код выхода ${code}` };
    }

    if (plan.mode === "session") {
        // Агент уходит жить в своё окно tmux. Оно и есть его учётная запись: имя окна —
        // ключ, живость — существование окна, остановка — kill-window.
        await openWindow({
            name: plan.key,
            cwd: plan.cwd,
            command: ["claude", ...plan.args].map(shellQuote).join(" "),
        });
        return { ...plan, cmd, ok: true };
    }

    const startedAt = Date.now();
    const finished = await runCaptured(plan.args, plan.cwd);
    append({
        at: new Date().toISOString(),
        kind: "finish",
        key: plan.key,
        ok: finished.ok,
        durationMs: Date.now() - startedAt,
        summary: finished.summary,
    });
    return { ...plan, cmd, ok: finished.ok, summary: finished.summary };
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
