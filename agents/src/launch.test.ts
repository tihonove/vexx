import { describe, expect, it } from "vitest";

import type { RoleSpec } from "./config.ts";
import { uuidFromKey } from "./keys.ts";
import { buildLaunch, skillPrompt } from "./launch.ts";

const orchestrate: RoleSpec = {
    skill: "orchestrate",
    mode: "oneshot",
    worktree: false,
    tools: "Bash Read Glob Grep",
    allow: ["mcp__agents__list_agents", "Bash(gh *)"],
    permissionMode: "acceptEdits",
};

const implement: RoleSpec = {
    skill: "implement",
    mode: "session",
    worktree: true,
    tools: "default",
    permissionMode: "bypassPermissions",
};

const base = { mcpPort: 7778, worktreeExists: false };

function flag(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1];
}

describe("buildLaunch — общее для всех ролей", () => {
    it("подкладывает MCP каждой роли: аналитик и наблюдатель за PR — такие же агенты", () => {
        for (const spec of [orchestrate, implement]) {
            const plan = buildLaunch({ ...base, role: "r", spec, arg: "" });
            expect(plan.args).toContain("--strict-mcp-config");
            expect(flag(plan.args, "--mcp-config")).toContain("http://127.0.0.1:7778/mcp");
        }
    });

    it("промпт — это вызов скилла с аргументом, и он всегда последний", () => {
        const plan = buildLaunch({ ...base, role: "implement", spec: implement, arg: "181" });
        expect(plan.args.at(-1)).toBe("/implement 181");
        expect(skillPrompt("orchestrate", "")).toBe("/orchestrate");
    });
});

describe("buildLaunch — ошейник", () => {
    it("сужает набор инструментов через --tools, а не только --allowedTools", () => {
        // --allowedTools раздаёт лишь разрешения: без --tools оркестратору оставались бы
        // видны Write, WebFetch и Task*. Проверено на прошлой версии машинерии.
        const plan = buildLaunch({ ...base, role: "orchestrate", spec: orchestrate, arg: "" });
        expect(flag(plan.args, "--tools")).toBe("Bash Read Glob Grep");
        expect(flag(plan.args, "--allowedTools")).toBe("mcp__agents__list_agents Bash(gh *)");
        expect(flag(plan.args, "--permission-mode")).toBe("acceptEdits");
    });

    it('"default" означает «не сужать» — флаг не передаётся вовсе', () => {
        const plan = buildLaunch({ ...base, role: "implement", spec: implement, arg: "181" });
        expect(plan.args).not.toContain("--tools");
    });
});

describe("buildLaunch — create-or-update по сессии", () => {
    it("нового агента заводит: своё дерево и НАШ session id", () => {
        const plan = buildLaunch({ ...base, role: "implement", spec: implement, arg: "181" });
        expect(plan.session).toBe("create");
        expect(flag(plan.args, "--worktree")).toBe("implement-181");
        expect(flag(plan.args, "--session-id")).toBe(uuidFromKey("implement-181"));
        // Дерева ещё нет, а заводить его claude умеет только из корня репозитория.
        expect(plan.cwd).not.toMatch(/worktrees/);
    });

    it("прежнего агента продолжает тем же id, из его дерева", () => {
        const plan = buildLaunch({ ...base, role: "implement", spec: implement, arg: "181", worktreeExists: true });
        expect(plan.session).toBe("resume");
        expect(flag(plan.args, "--resume")).toBe(uuidFromKey("implement-181"));
        expect(plan.args).not.toContain("--worktree");
        expect(plan.cwd).toMatch(/\.claude\/worktrees\/implement-181$/);
    });

    it("id один и тот же при создании и при продолжении — иначе агента не позвать обратно", () => {
        const created = buildLaunch({ ...base, role: "implement", spec: implement, arg: "181" });
        const resumed = buildLaunch({ ...base, role: "implement", spec: implement, arg: "181", worktreeExists: true });
        expect(flag(created.args, "--session-id")).toBe(flag(resumed.args, "--resume"));
    });

    it("oneshot-роль сессией не обзаводится вовсе", () => {
        // Оркестратор обязан начинать каждый тик с чистого листа: накопленный контекст
        // ушёл бы в компакт и дал частичную память — она хуже, чем никакой.
        const plan = buildLaunch({ ...base, role: "orchestrate", spec: orchestrate, arg: "" });
        expect(plan.session).toBe("fresh");
        expect(plan.args).not.toContain("--resume");
        expect(plan.args).not.toContain("--session-id");
    });
});

describe("buildLaunch — режимы", () => {
    it("oneshot печатает результат машинно и умирает", () => {
        const plan = buildLaunch({ ...base, role: "orchestrate", spec: orchestrate, arg: "" });
        expect(plan.args).toContain("-p");
        expect(flag(plan.args, "--output-format")).toBe("json");
    });

    it("session остаётся интерактивным: ни -p, ни --background", () => {
        // Интерактивность здесь не роскошь: только ей можно задать свой --session-id.
        const plan = buildLaunch({ ...base, role: "implement", spec: implement, arg: "181" });
        expect(plan.args).not.toContain("-p");
        expect(plan.args).not.toContain("--background");
    });
});
