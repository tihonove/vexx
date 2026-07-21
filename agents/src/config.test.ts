import { describe, expect, it } from "vitest";

import { DEFAULT_PORTS, loadConfig, validateConfig } from "./config.ts";

const minimal = { roles: { implement: { skill: "implement" } } };

describe("validateConfig", () => {
    it("роли без флагов — самые скромные: своего дерева нет, фона нет, памяти нет", () => {
        const config = validateConfig(minimal);
        expect(config.roles.implement).toMatchObject({ worktree: false, background: false, resume: false });
        expect(config.ports).toEqual(DEFAULT_PORTS);
    });

    it("запрещает resume без своего дерева", () => {
        // Иначе сессия искалась бы в каталоге корня репозитория, где лежат
        // ИНТЕРАКТИВНЫЕ сессии человека, — и агент продолжил бы чужой разговор.
        expect(() => validateConfig({ roles: { r: { skill: "implement", resume: true } } })).toThrow(/требует `worktree: true`/);
    });

    it("требует хотя бы одну роль", () => {
        expect(() => validateConfig({ roles: {} })).toThrow(/непустым объектом/);
    });

    it("не пускает имя роли, которое станет опасным путём", () => {
        expect(() => validateConfig({ roles: { "../evil": { skill: "implement" } } })).toThrow(/именем worktree/);
    });

    it("не даёт витрине и MCP сесть на один порт", () => {
        expect(() => validateConfig({ ...minimal, ports: { dashboard: 7777, mcp: 7777 } })).toThrow(/должны отличаться/);
    });

    it("ловит опечатки в типах полей роли", () => {
        expect(() => validateConfig({ roles: { r: { skill: "implement", allow: "Read" } } })).toThrow(/массивом строк/);
        expect(() => validateConfig({ roles: { r: { skill: "implement", worktree: "yes" } } })).toThrow(/boolean/);
    });
});

describe("боевой config.jsonc", () => {
    it("разбирается и описывает обе роли", () => {
        const config = loadConfig();
        expect(config.roles.orchestrate).toMatchObject({ skill: "orchestrate", worktree: false, everyMin: 10 });
        // Оркестратор должен ходить в gh и на доску — иначе он не увидит очередь задач.
        expect(config.roles.orchestrate?.allow).toContain("Bash(gh *)");
        expect(config.roles.implement).toMatchObject({ worktree: true, background: true, resume: true });
    });
});
