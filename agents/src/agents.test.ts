import { describe, expect, it } from "vitest";

import {
    type AgentInfo,
    checkLimits,
    digestSessionLines,
    isManagedSession,
    planReap,
    type RawSession,
    toAgentInfo,
} from "./agents.ts";
import type { Limits } from "./config.ts";
import type { HistoryEvent } from "./history.ts";

const WORKTREES = "/repo/.claude/worktrees";

function session(overrides: Partial<RawSession> = {}): RawSession {
    return {
        pid: 100,
        id: "abc12345",
        cwd: `${WORKTREES}/issue-136`,
        kind: "background",
        startedAt: 1_000_000,
        sessionId: "abc12345-0000-0000-0000-000000000000",
        name: "/implement task.json",
        status: "busy",
        ...overrides,
    };
}

const limits: Limits = { maxConcurrent: 2, spawnsPerHour: 4, tickIntervalMin: 10, reapIdleMin: 10, maxAgeMin: 360 };

describe("isManagedSession", () => {
    it("берёт фоновые сессии внутри worktrees", () => {
        expect(isManagedSession(session(), WORKTREES)).toBe(true);
    });

    it("не трогает интерактивные сессии — это разговоры с человеком", () => {
        expect(isManagedSession(session({ kind: "interactive" }), WORKTREES)).toBe(false);
    });

    it("не трогает фоновые сессии вне worktrees", () => {
        expect(isManagedSession(session({ cwd: "/repo" }), WORKTREES)).toBe(false);
        expect(isManagedSession(session({ cwd: "/elsewhere/.claude/worktrees/x" }), WORKTREES)).toBe(false);
    });

    it("не путает каталог-префикс с каталогом", () => {
        expect(isManagedSession(session({ cwd: `${WORKTREES}-evil/x` }), WORKTREES)).toBe(false);
    });
});

describe("toAgentInfo", () => {
    it("берёт имя агента из имени worktree и считает возраст", () => {
        const agents = toAgentInfo(
            [session(), session({ kind: "interactive", cwd: "/repo" })],
            1_000_000 + 5 * 60_000,
            { alive: () => true, idleMin: () => 3, branch: () => "worktree-issue-136" },
            WORKTREES,
        );
        expect(agents).toHaveLength(1);
        expect(agents[0]).toMatchObject({ name: "issue-136", agentId: "abc12345", idleMin: 3, alive: true, ageMin: 5 });
    });

    it("переживает отсутствие файла сессии", () => {
        const agents = toAgentInfo([session()], 1_000_000, { alive: () => false, idleMin: () => null, branch: () => null }, WORKTREES);
        expect(agents[0]).toMatchObject({ idleMin: null, alive: false });
    });
});

describe("checkLimits", () => {
    const now = new Date("2026-07-20T21:00:00Z");
    const running = (count: number) =>
        Array.from({ length: count }, (_, index) =>
            toAgentInfo([session({ cwd: `${WORKTREES}/issue-${index}` })], 0, { alive: () => true, idleMin: () => 0, branch: () => null }, WORKTREES)[0]!,
        );

    it("пропускает, когда всё в пределах", () => {
        expect(checkLimits({ name: "issue-9", running: [], history: [], limits, dryRun: false, now })).toBeUndefined();
    });

    it("отказывает в dry-run", () => {
        const refusal = checkLimits({ name: "issue-9", running: [], history: [], limits, dryRun: true, now });
        expect(refusal?.reason).toContain("dry-run");
    });

    it("отказывает при исчерпании слотов", () => {
        const refusal = checkLimits({ name: "issue-9", running: running(2), history: [], limits, dryRun: false, now });
        expect(refusal?.reason).toContain("at capacity");
    });

    it("отказывает, если агент с таким именем уже работает", () => {
        const refusal = checkLimits({ name: "issue-0", running: running(1), history: [], limits, dryRun: false, now });
        expect(refusal?.reason).toContain("уже запущен");
    });

    it("считает rate limit по журналу, а не по памяти", () => {
        const history: HistoryEvent[] = Array.from({ length: 4 }, (_, index) => ({
            at: new Date(now.getTime() - index * 60_000).toISOString(),
            kind: "spawn",
            name: `issue-${index}`,
            skill: "implement",
        }));
        expect(checkLimits({ name: "issue-9", running: [], history, limits, dryRun: false, now })?.reason).toContain("rate limited");
    });

    it("не считает спавны старше часа", () => {
        const history: HistoryEvent[] = Array.from({ length: 4 }, (_, index) => ({
            at: new Date(now.getTime() - 3600_000 - index * 60_000).toISOString(),
            kind: "spawn",
            name: `issue-${index}`,
            skill: "implement",
        }));
        expect(checkLimits({ name: "issue-9", running: [], history, limits, dryRun: false, now })).toBeUndefined();
    });
});

describe("digestSessionLines", () => {
    it("сжимает записи до «кто что вызвал» и режет по лимиту", () => {
        const lines = [
            JSON.stringify({ message: { role: "assistant", content: [{ type: "tool_use", name: "Bash", input: { command: "npm test" } }] } }),
            JSON.stringify({ message: { role: "assistant", content: [{ type: "text", text: "Готово" }] } }),
            "не json",
        ];
        expect(digestSessionLines(lines, 10)).toEqual(["assistant | tool: Bash — npm test", "assistant | text: Готово"]);
        expect(digestSessionLines(lines, 1)).toEqual(["assistant | text: Готово"]);
    });
});

describe("planReap", () => {
    const agent = (overrides: Partial<AgentInfo> = {}): AgentInfo => ({
        name: "issue-136",
        agentId: "abc12345",
        sessionId: "s",
        pid: 1,
        status: "busy",
        worktree: `${WORKTREES}/issue-136`,
        branch: "worktree-issue-136",
        idleMin: 0,
        alive: true,
        ageMin: 5,
        ...overrides,
    });

    it("не трогает работающего", () => {
        expect(planReap([agent()], limits)).toHaveLength(0);
    });

    it("останавливает доработавшего: он сам не завершится и держит слот", () => {
        const decisions = planReap([agent({ status: "idle", idleMin: 12 })], limits);
        expect(decisions[0]?.reason).toContain("доработал");
    });

    it("даёт передышку недавно затихшему — вдруг к нему подключились руками", () => {
        expect(planReap([agent({ status: "idle", idleMin: 3 })], limits)).toHaveLength(0);
    });

    it("останавливает застрявшего по возрасту, даже если он занят", () => {
        const decisions = planReap([agent({ status: "busy", ageMin: 400, idleMin: 1 })], limits);
        expect(decisions[0]?.reason).toContain("застрял");
    });

    it("не пытается останавливать мёртвый процесс", () => {
        expect(planReap([agent({ alive: false, status: "idle", idleMin: 999, ageMin: 999 })], limits)).toHaveLength(0);
    });
});
