import { describe, expect, it } from "vitest";

import { agentKey, pickLatest } from "./keys.ts";

describe("agentKey", () => {
    it("склеивает роль и аргумент — связка «задача ↔ агент» видна в имени каталога", () => {
        expect(agentKey("implement", "181")).toBe("implement-181");
    });

    it("без аргумента ключ — это просто роль", () => {
        expect(agentKey("orchestrate")).toBe("orchestrate");
        expect(agentKey("orchestrate", "  ")).toBe("orchestrate");
    });

    it("отказывается делать ключ, который станет опасным путём", () => {
        // Ключ становится именем каталога, поэтому побег из .claude/worktrees/ должен
        // ломаться здесь, а не превращаться в запись мимо песочницы.
        expect(() => agentKey("implement", "../../etc")).toThrow(/небезопасный ключ/);
        expect(() => agentKey("implement", "a/b")).toThrow(/небезопасный ключ/);
    });
});

describe("pickLatest", () => {
    it("выбирает самый свежий файл сессии", () => {
        expect(
            pickLatest([
                { name: "aaa.jsonl", mtimeMs: 100 },
                { name: "bbb.jsonl", mtimeMs: 300 },
                { name: "ccc.jsonl", mtimeMs: 200 },
            ]),
        ).toBe("bbb");
    });

    it("игнорирует посторонние файлы каталога сессий", () => {
        expect(
            pickLatest([
                { name: "memory", mtimeMs: 999 },
                { name: "aaa.jsonl", mtimeMs: 100 },
            ]),
        ).toBe("aaa");
    });

    it("пустой каталог — это «агент ещё не запускался», а не ошибка", () => {
        expect(pickLatest([])).toBeUndefined();
    });
});
