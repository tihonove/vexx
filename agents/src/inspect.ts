// Взгляд на живых агентов. Реестра мы не заводим: агент — это окно tmux, и всё, что
// о нём нужно знать, выводится из мира заново на каждый вызов.
//
//   живость и возраст  ← список окон tmux (имя окна = ключ агента)
//   status / state     ← claude agents --json, сопоставление по рабочему каталогу
//   ветка              ← git в самом дереве
//
// Поэтому перезапуск сервера ничего не восстанавливает: он просто снова смотрит. И агенты
// его смерть переживают — они живут в tmux, а не в нём.
import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { uuidFromKey } from "./keys.ts";
import { sessionFile, worktreePath } from "./paths.ts";
import { listAgentWindows } from "./tmux.ts";

/** Сырая запись из `claude agents --json`. */
export interface RawSession {
    pid: number;
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
    /** Ключ агента: имя окна tmux, оно же имя дерева. Связка «задача ↔ агент» видна. */
    key: string;
    /** Детерминированный id сессии — тот самый, которым агента и зовут обратно. */
    sessionId: string;
    worktree: string;
    /** Что докладывает сам claude. `null`, если сессию он ещё не зарегистрировал. */
    status: string | null;
    state?: string;
    /** Ветка читается из дерева: её имя задаёт claude, а не мы. */
    branch: string | null;
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
    try {
        return JSON.parse(await run("claude", ["agents", "--json"])) as RawSession[];
    } catch {
        return [];
    }
}

/**
 * Чистая часть: соединение окон tmux с тем, что докладывает claude. Тестируется без сети
 * и без tmux — а это ровно та склейка, где легко перепутать «нет окна» и «нет статуса».
 */
export function toAgentInfo(
    windows: { name: string; ageSec: number }[],
    sessions: RawSession[],
    deps: { branch: (cwd: string) => string | null; worktree: (key: string) => string },
): AgentInfo[] {
    const byCwd = new Map(sessions.map(session => [session.cwd, session]));
    return windows.map(window => {
        const worktree = deps.worktree(window.name);
        const session = byCwd.get(worktree);
        return {
            key: window.name,
            sessionId: uuidFromKey(window.name),
            worktree,
            status: session?.status ?? null,
            state: session?.state,
            branch: deps.branch(worktree),
            ageMin: Math.floor(window.ageSec / 60),
        };
    });
}

function currentBranch(cwd: string): string | null {
    try {
        return execFileSync("git", ["-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim() || null;
    } catch {
        return null;
    }
}

export async function listAgents(): Promise<AgentInfo[]> {
    const [windows, sessions] = await Promise.all([listAgentWindows(), readSessions()]);
    return toAgentInfo(windows, sessions, { branch: currentBranch, worktree: worktreePath });
}

/**
 * Сжатый хвост сессии. Единственное место, которое читает сессионный JSONL, и это
 * осознанный долг: штатный `claude logs` отдаёт сырой ANSI-дамп терминала, по которому
 * судить о работе агента нельзя — ни человеку, ни тем более модели.
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
