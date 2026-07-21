import { describe, expect, it } from "vitest";

import { digestSessionLines, type RawSession, toAgentInfo } from "./inspect.ts";
import { uuidFromKey } from "./keys.ts";
import { encodeProjectDir } from "./paths.ts";
import { parseWindows, SERVER_WINDOW } from "./tmux.ts";

const worktree = (key: string) => `/repo/.claude/worktrees/${key}`;

function session(overrides: Partial<RawSession> = {}): RawSession {
    return {
        pid: 100,
        cwd: worktree("implement-136"),
        kind: "interactive",
        startedAt: 1_000_000,
        sessionId: uuidFromKey("implement-136"),
        name: "implement-136",
        status: "busy",
        ...overrides,
    };
}

describe("parseWindows", () => {
    it("окно tmux — это агент, а его имя — ключ", () => {
        const windows = parseWindows("implement-136\t1000\nimplement-181\t940\n", 1060);
        expect(windows).toEqual([
            { name: "implement-136", ageSec: 60 },
            { name: "implement-181", ageSec: 120 },
        ]);
    });

    it("окно сервера агентом не считается — иначе машинерия убила бы сама себя", () => {
        expect(parseWindows(`${SERVER_WINDOW}\t1000\nimplement-136\t1000\n`, 1000).map(w => w.name)).toEqual(["implement-136"]);
    });

    it("пустой вывод — это «агентов нет», а не ошибка", () => {
        expect(parseWindows("", 1000)).toEqual([]);
    });
});

describe("toAgentInfo", () => {
    it("склеивает окно tmux со статусом от claude по рабочему каталогу", () => {
        const agents = toAgentInfo([{ name: "implement-136", ageSec: 300 }], [session()], {
            branch: () => "worktree-implement-136",
            worktree,
        });
        expect(agents).toHaveLength(1);
        expect(agents[0]).toMatchObject({
            key: "implement-136",
            status: "busy",
            ageMin: 5,
            branch: "worktree-implement-136",
            sessionId: uuidFromKey("implement-136"),
        });
    });

    it("окно есть, а статуса нет — агент считается живым: реестр это tmux, а не claude", () => {
        // Сессия могла ещё не зарегистрироваться или уже закрыться, но пока окно живо,
        // агент занимает место, и оркестратор должен его видеть.
        const agents = toAgentInfo([{ name: "implement-181", ageSec: 0 }], [], { branch: () => null, worktree });
        expect(agents[0]).toMatchObject({ key: "implement-181", status: null });
    });

    it("чужие сессии claude в список не попадают", () => {
        // У человека свой разговор в корне репозитория — окна tmux у него нет,
        // значит и агентом он не станет ни при каких обстоятельствах.
        const agents = toAgentInfo([], [session({ cwd: "/repo" })], { branch: () => null, worktree });
        expect(agents).toEqual([]);
    });
});

describe("encodeProjectDir", () => {
    // Пропущенные точки однажды уже сломали весь heartbeat молча: файл сессии не находился.
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
