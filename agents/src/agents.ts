// Словарь про агентов и только про них: кто жив, запусти, останови.
// Ни issue, ни лейблов, ни доски здесь нет — этим занимается оркестратор.
//
// Реестра в памяти нет принципиально: состояние выводится из мира заново на каждый вызов
// (`claude agents --json`, mtime сессионного JSONL, git в worktree). Поэтому перезапуск
// демона ничего не восстанавливает — он просто снова смотрит.
import { execFile } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

import type { Limits } from "./config.ts";
import { countSpawnsSince, type HistoryEvent } from "./history.ts";
import { sessionFile, worktreePath, WORKTREES_DIR } from "./paths.ts";

/** Имя агента = имя его worktree = имя каталога, поэтому оно должно быть безопасным для пути. */
export const AGENT_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

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
    /** Имя агента = имя его worktree. Связка «задача ↔ агент» видна, а не хранится. */
    name: string;
    agentId: string;
    sessionId: string;
    pid: number;
    status: string;
    state?: string;
    worktree: string;
    /** Минут с последней записи в сессионный JSONL — бесплатный heartbeat. */
    idleMin: number | null;
    alive: boolean;
    ageMin: number;
}

function run(command: string, args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(command, args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`${command} ${args.join(" ")}: ${stderr.trim() || error.message}`));
                return;
            }
            resolve(stdout);
        });
    });
}

export async function readSessions(): Promise<RawSession[]> {
    const raw = await run("claude", ["agents", "--json"]);
    return JSON.parse(raw) as RawSession[];
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

function idleMinutes(cwd: string, sessionId: string, now: number): number | null {
    const file = sessionFile(cwd, sessionId);
    try {
        return Math.floor((now - statSync(file).mtimeMs) / 60000);
    } catch {
        return null;
    }
}

/** Чистая часть: превращение сырых сессий в наш взгляд на агентов. Тестируется без сети. */
export function toAgentInfo(
    sessions: RawSession[],
    now: number,
    deps: { alive: (pid: number) => boolean; idleMin: (cwd: string, sessionId: string) => number | null },
    worktreesDir = WORKTREES_DIR,
): AgentInfo[] {
    return sessions
        .filter(session => isManagedSession(session, worktreesDir))
        .map(session => ({
            name: basename(session.cwd),
            // У фоновой сессии короткий id есть всегда; страхуемся на случай изменения формата.
            agentId: session.id ?? session.sessionId.slice(0, 8),
            sessionId: session.sessionId,
            pid: session.pid,
            status: session.status,
            state: session.state,
            worktree: session.cwd,
            idleMin: deps.idleMin(session.cwd, session.sessionId),
            alive: deps.alive(session.pid),
            ageMin: Math.floor((now - session.startedAt) / 60000),
        }));
}

export async function listAgents(): Promise<AgentInfo[]> {
    const now = Date.now();
    return toAgentInfo(await readSessions(), now, {
        alive: isProcessAlive,
        idleMin: (cwd, sessionId) => idleMinutes(cwd, sessionId, now),
    });
}

export interface SpawnRefusal {
    refused: true;
    reason: string;
    running: number;
}

export interface SpawnResult {
    refused: false;
    name: string;
    skill: string;
    worktree: string;
    prompt: string;
}

/**
 * Чистая проверка потолков — единственное место, где они живут. Инструкция в SKILL.md
 * была бы пожеланием, которое модель себе уговорит; отказ инструмента — факт.
 */
export function checkLimits(
    args: { name: string; running: AgentInfo[]; history: HistoryEvent[]; limits: Limits; dryRun: boolean; now: Date },
): SpawnRefusal | undefined {
    const running = args.running.length;
    if (args.running.some(agent => agent.name === args.name)) {
        return { refused: true, reason: `агент "${args.name}" уже запущен`, running };
    }
    if (args.dryRun) {
        return { refused: true, reason: "dry-run: спавн выключен в config.jsonc", running };
    }
    if (running >= args.limits.maxConcurrent) {
        return { refused: true, reason: `at capacity: ${running}/${args.limits.maxConcurrent}`, running };
    }
    const hourAgo = new Date(args.now.getTime() - 3600_000);
    const recent = countSpawnsSince(args.history, hourAgo);
    if (recent >= args.limits.spawnsPerHour) {
        return { refused: true, reason: `rate limited: ${recent} спавнов за последний час`, running };
    }
    return undefined;
}

/**
 * Запуск агента. `--bg` создаёт фоновую сессию в своём worktree — она видна в
 * `claude agents --json`, переживает перезапуск демона и позволяет `claude attach`,
 * чтобы перехватить агента и договорить руками.
 *
 * Важно: скилл должен быть ЗАКОММИЧЕН. Агент работает в свежем worktree, где
 * неотслеживаемых файлов нет, и незакоммиченный `.claude/skills/*` до него не доедет.
 */
export function skillPrompt(skill: string, args: string): string {
    return `/${skill}${args.trim() ? ` ${args.trim()}` : ""}`;
}

export async function spawnAgent(args: { name: string; skill: string; args: string }): Promise<SpawnResult> {
    const prompt = skillPrompt(args.skill, args.args);
    await run("claude", ["--worktree", args.name, "--background", "--permission-mode", "acceptEdits", prompt]);
    return { refused: false, name: args.name, skill: args.skill, worktree: worktreePath(args.name), prompt };
}

/**
 * Остановка — штатным `claude stop <id>`, а не SIGTERM: диалог сохраняется, агента можно
 * поднять обратно через `claude attach`. Смерть агента становится штатной операцией.
 */
export async function stopAgent(agentId: string): Promise<void> {
    await run("claude", ["stop", agentId]);
}

/**
 * Сжатый хвост сессионного JSONL. Читаем именно его, а не `claude logs <id>`: тот отдаёт
 * сырой ANSI-дамп терминала, по которому судить о работе агента невозможно.
 *
 * Отдаём не сырые строки (они огромные и сожгут контекст оркестратора), а выжимку:
 * какой инструмент вызван и с чем. По ней и видно «долбит один и тот же тест по кругу».
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
            const hint = typeof input?.command === "string" ? input.command : typeof input?.file_path === "string" ? input.file_path : "";
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
