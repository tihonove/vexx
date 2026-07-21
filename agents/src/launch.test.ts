import { describe, expect, it } from "vitest";

import type { RoleSpec } from "./config.ts";
import { buildLaunch, skillPrompt } from "./launch.ts";

const orchestrate: RoleSpec = {
    skill: "orchestrate",
    worktree: false,
    background: false,
    resume: false,
    tools: "Bash Read Glob Grep",
    allow: ["mcp__agents__list_agents", "Bash(gh *)"],
    permissionMode: "acceptEdits",
};

const implement: RoleSpec = {
    skill: "implement",
    worktree: true,
    background: true,
    resume: true,
    tools: "default",
    permissionMode: "bypassPermissions",
};

const base = { mcpPort: 7778, worktreeExists: false };

function flag(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1];
}

describe("buildLaunch — общие для всех ролей", () => {
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
    it("нового агента заводит с новой сессией и создаёт ему дерево", () => {
        const plan = buildLaunch({ ...base, role: "implement", spec: implement, arg: "181" });
        expect(plan.session).toBe("create");
        expect(flag(plan.args, "--worktree")).toBe("implement-181");
        expect(plan.args).not.toContain("--resume");
    });

    it("прежнего агента продолжает: --resume и дерево не пересоздаётся", () => {
        const plan = buildLaunch({
            ...base,
            role: "implement",
            spec: implement,
            arg: "181",
            worktreeExists: true,
            sessionId: "c0cfee5c-1090-4934-8482-f0b1814e0d85",
        });
        expect(plan.session).toBe("resume");
        expect(flag(plan.args, "--resume")).toBe("c0cfee5c-1090-4934-8482-f0b1814e0d85");
        expect(plan.args).not.toContain("--worktree");
        expect(plan.cwd).toMatch(/\.claude\/worktrees\/implement-181$/);
    });

    it("роль без resume не подхватывает чужую сессию, даже если та найдена", () => {
        // Оркестратор обязан начинать каждый тик с чистого листа: накопленный контекст
        // ушёл бы в компакт и дал частичную память — она хуже, чем никакой.
        const plan = buildLaunch({ ...base, role: "orchestrate", spec: orchestrate, arg: "", sessionId: "какая-то" });
        expect(plan.session).toBe("fresh");
        expect(plan.args).not.toContain("--resume");
    });
});

describe("buildLaunch — режимы запуска", () => {
    it("фоновая роль уходит в --background", () => {
        const plan = buildLaunch({ ...base, role: "implement", spec: implement, arg: "181" });
        expect(plan.args).toContain("--background");
        expect(plan.background).toBe(true);
    });

    it("не фоновая роль печатает результат машинно", () => {
        const plan = buildLaunch({ ...base, role: "orchestrate", spec: orchestrate, arg: "" });
        expect(plan.args).toContain("-p");
        expect(flag(plan.args, "--output-format")).toBe("json");
    });

    it("отладка руками — живой диалог: ни фона, ни -p", () => {
        const plan = buildLaunch({ ...base, role: "implement", spec: implement, arg: "181", interactive: true });
        expect(plan.args).not.toContain("--background");
        expect(plan.args).not.toContain("-p");
        expect(plan.background).toBe(false);
    });
});
