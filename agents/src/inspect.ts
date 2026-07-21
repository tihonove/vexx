// Взгляд на живых агентов. Реестра нет принципиально: состояние выводится из мира заново
// на каждый вызов — `claude agents --json`, mtime сессионного JSONL, git в worktree.
// Поэтому перезапуск сервера ничего не восстанавливает: он просто снова смотрит.
import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

import { sessionFile, WORKTREES_DIR } from "./paths.ts";

/** Сырая запись из `claude agents --json`. */
export interface RawSession {
    pid: number;
    /** Короткий id есть только у фоновых сессий — им же оперируют `claude logs/stop/attach`. */
    id?: string;
    cwd: string;
    kind: "background" | "interactive";
    startedAt: number;
    sessionId: string;
    name: string;
    status: string;
    state?: string;
}

export interface AgentInfo {
    /** Имя агента = ключ = имя его worktree. Связка «задача ↔ агент» видна, а не хранится. */
    key: string;
    agentId: string;
    sessionId: string;
    pid: number;
    status: string;
    state?: string;
    worktree: string;
    /** Читается из самого worktree, а не выводится из ключа: имя ветки задаёт claude, не мы. */
    branch: string | null;
    /** Минут с последней записи в сессионный JSONL — бесплатный heartbeat. */
    idleMin: number | null;
    alive: boolean;
    ageMin: number;
}

function run(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(command, args, { maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) reject(new Error(`${command} ${args.join(" ")}: ${stderr.trim() || error.message}`));
            else resolve(stdout);
        });
    });
}

export async function readSessions(): Promise<RawSession[]> {
    return JSON.parse(await run("claude", ["agents", "--json"])) as RawSession[];
}

/**
 * Наши агенты — и только они. Инвариант всей машинерии: она трогает исключительно фоновые
 * сессии внутри `.claude/worktrees/`. Интерактивные сессии — это разговоры с человеком,
 * под нож они не идут никогда, даже при `stop --now`.
 */
export function isManagedSession(session: RawSession, worktreesDir = WORKTREES_DIR): boolean {
    return session.kind === "background" && session.cwd.startsWith(`${worktreesDir}/`);
}

export function isProcessAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

/** Чистая часть: превращение сырых сессий в наш взгляд на агентов. Тестируется без сети. */
export function toAgentInfo(
    sessions: RawSession[],
    now: number,
    deps: {
        alive: (pid: number) => boolean;
        idleMin: (cwd: string, sessionId: string) => number | null;
        branch: (cwd: string) => string | null;
    },
    worktreesDir = WORKTREES_DIR,
): AgentInfo[] {
    return sessions
        .filter(session => isManagedSession(session, worktreesDir))
        .map(session => ({
            key: basename(session.cwd),
            // У фоновой сессии короткий id есть всегда; страхуемся на случай изменения формата.
            agentId: session.id ?? session.sessionId.slice(0, 8),
            sessionId: session.sessionId,
            pid: session.pid,
            status: session.status,
            state: session.state,
            worktree: session.cwd,
            branch: deps.branch(session.cwd),
            idleMin: deps.idleMin(session.cwd, session.sessionId),
            alive: deps.alive(session.pid),
            ageMin: Math.floor((now - session.startedAt) / 60000),
        }));
}

function idleMinutes(cwd: string, sessionId: string, now: number): number | null {
    try {
        return Math.floor((now - statSync(sessionFile(cwd, sessionId)).mtimeMs) / 60000);
    } catch {
        return null;
    }
}

function currentBranch(cwd: string): string | null {
    try {
        return execFileSync("git", ["-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim() || null;
    } catch {
        return null;
    }
}

export async function listAgents(): Promise<AgentInfo[]> {
    const now = Date.now();
    return toAgentInfo(await readSessions(), now, {
        alive: isProcessAlive,
        idleMin: (cwd, sessionId) => idleMinutes(cwd, sessionId, now),
        branch: currentBranch,
    });
}

/**
 * Остановка — штатным `claude stop <id>`, а не SIGTERM: диалог сохраняется, к агенту можно
 * вернуться. Смерть агента становится штатной операцией, а не аварией.
 */
export async function stopAgent(agentId: string): Promise<void> {
    await run("claude", ["stop", agentId]);
}

/**
 * Сжатый хвост сессионного JSONL. Читаем именно его, а не `claude logs <id>`: тот отдаёт
 * сырой ANSI-дамп терминала, по которому судить о работе агента невозможно.
 *
 * Отдаём не сырые строки (они огромные и сожгут контекст читающего), а выжимку: какой
 * инструмент вызван и с чем. По ней и видно «долбит один и тот же тест по кругу».
 */
export function digestSessionLines(lines: string[], limit: number): string[] {
    const digest: string[] = [];
    for (const line of lines) {
        let entry: unknown;
        try {
            entry = JSON.parse(line);
        } catch {
            continue;
        }
        const summary = summarizeEntry(entry);
        if (summary) digest.push(summary);
    }
    return digest.slice(Math.max(0, digest.length - limit));
}

function summarizeEntry(entry: unknown): string | undefined {
    if (typeof entry !== "object" || entry === null) return undefined;
    const record = entry as Record<string, unknown>;
    const message = record.message as { role?: string; content?: unknown } | undefined;
    const content = message?.content;
    if (!Array.isArray(content)) return undefined;

    const parts: string[] = [];
    for (const block of content) {
        if (typeof block !== "object" || block === null) continue;
        const item = block as Record<string, unknown>;
        if (item.type === "text" && typeof item.text === "string" && item.text.trim()) {
            parts.push(`text: ${item.text.trim().slice(0, 200)}`);
        }
        if (item.type === "tool_use" && typeof item.name === "string") {
            const input = item.input as Record<string, unknown> | undefined;
            const hint =
                typeof input?.command === "string" ? input.command : typeof input?.file_path === "string" ? input.file_path : "";
            parts.push(`tool: ${item.name}${hint ? ` — ${String(hint).slice(0, 160)}` : ""}`);
        }
    }
    if (parts.length === 0) return undefined;
    return `${message?.role ?? "?"} | ${parts.join(" ; ")}`;
}

export function readAgentLog(agent: AgentInfo, limit: number): string[] {
    const file = sessionFile(agent.worktree, agent.sessionId);
    if (!existsSync(file)) return [];
    const lines = readFileSync(file, "utf8").split("\n").filter(line => line.trim().length > 0);
    return digestSessionLines(lines, limit);
}
