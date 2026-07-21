import { describe, expect, it } from "vitest";

import { DEFAULT_PORTS, loadConfig, validateConfig } from "./config.ts";

const minimal = { roles: { implement: { skill: "implement" } } };

describe("validateConfig", () => {
    it("роль без флагов — самая скромная: разовый запуск, своего дерева нет", () => {
        const config = validateConfig(minimal);
        expect(config.roles.implement).toMatchObject({ mode: "oneshot", worktree: false });
        expect(config.ports).toEqual(DEFAULT_PORTS);
    });

    it("запрещает долгоживущего агента без своего дерева", () => {
        // Иначе двое таких подерутся за ветку рабочей копии — этот инцидент уже был.
        expect(() => validateConfig({ roles: { r: { skill: "implement", mode: "session" } } })).toThrow(/требует `worktree: true`/);
    });

    it("ловит опечатку в режиме", () => {
        expect(() => validateConfig({ roles: { r: { skill: "implement", mode: "background" } } })).toThrow(/mode/);
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
        expect(config.roles.implement).toMatchObject({ mode: "session", worktree: true });
    });
});
