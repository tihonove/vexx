import { describe, expect, it } from "vitest";

import { agentKey, uuidFromKey } from "./keys.ts";

describe("agentKey", () => {
    it("склеивает роль и аргумент — связка «задача ↔ агент» видна в имени окна и каталога", () => {
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

describe("uuidFromKey", () => {
    it("один и тот же ключ всегда даёт один и тот же id — на этом держится «позвать обратно»", () => {
        expect(uuidFromKey("implement-181")).toBe(uuidFromKey("implement-181"));
    });

    it("разные ключи дают разные id", () => {
        expect(uuidFromKey("implement-181")).not.toBe(uuidFromKey("implement-182"));
    });

    it("выдаёт валидный UUID версии 5 — claude принимает только такие", () => {
        expect(uuidFromKey("implement-181")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("совпадает с эталоном RFC 4122 для пространства имён DNS", () => {
        // Контрольная точка из спецификации: uuidv5(DNS, "www.example.org").
        expect(uuidFromKey("www.example.org")).toBe("74738ff5-5367-5958-9aee-98fffdcd1876");
    });
});
