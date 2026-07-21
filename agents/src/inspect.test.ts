import { describe, expect, it } from "vitest";

import { digestSessionLines, isManagedSession, type RawSession, toAgentInfo } from "./inspect.ts";
import { encodeProjectDir } from "./paths.ts";

const WORKTREES = "/repo/.claude/worktrees";

function session(overrides: Partial<RawSession> = {}): RawSession {
    return {
        pid: 100,
        id: "abc12345",
        cwd: `${WORKTREES}/implement-136`,
        kind: "background",
        startedAt: 1_000_000,
        sessionId: "abc12345-0000-0000-0000-000000000000",
        name: "/implement 136",
        status: "busy",
        ...overrides,
    };
}

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
    it("берёт ключ агента из имени worktree и считает возраст", () => {
        const agents = toAgentInfo(
            [session(), session({ kind: "interactive", cwd: "/repo" })],
            1_000_000 + 5 * 60_000,
            { alive: () => true, idleMin: () => 3, branch: () => "worktree-implement-136" },
            WORKTREES,
        );
        expect(agents).toHaveLength(1);
        expect(agents[0]).toMatchObject({ key: "implement-136", agentId: "abc12345", idleMin: 3, alive: true, ageMin: 5 });
    });

    it("переживает отсутствие файла сессии", () => {
        const agents = toAgentInfo(
            [session()],
            1_000_000,
            { alive: () => false, idleMin: () => null, branch: () => null },
            WORKTREES,
        );
        expect(agents[0]).toMatchObject({ idleMin: null, alive: false });
    });
});

describe("encodeProjectDir", () => {
    // Пропущенные точки однажды уже сломали весь heartbeat молча: файл сессии не находился,
    // и idleMin всегда был null. Поэтому проверка именно на точку.
    it("заменяет на дефис и слэши, и точки", () => {
        expect(encodeProjectDir("/workspaces/vexx/.claude/worktrees/implement-181")).toBe(
            "-workspaces-vexx--claude-worktrees-implement-181",
        );
    });
});

describe("digestSessionLines", () => {
    it("сжимает записи до «кто что вызвал» и режет по лимиту", () => {
        const lines = [
            JSON.stringify({
                message: { role: "assistant", content: [{ type: "tool_use", name: "Bash", input: { command: "npm test" } }] },
            }),
            JSON.stringify({ message: { role: "assistant", content: [{ type: "text", text: "Готово" }] } }),
            "не json",
        ];
        expect(digestSessionLines(lines, 10)).toEqual(["assistant | tool: Bash — npm test", "assistant | text: Готово"]);
        expect(digestSessionLines(lines, 1)).toEqual(["assistant | text: Готово"]);
    });
});
