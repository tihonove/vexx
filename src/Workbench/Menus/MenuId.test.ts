import { describe, expect, it } from "vitest";

import { MenuId } from "./MenuId.ts";

describe("MenuId", () => {
    it("встроенные точки — инстансы класса с читаемым id", () => {
        expect(MenuId.EditorContext.id).toBe("EditorContext");
        expect(MenuId.MenubarMainMenu.id).toBe("MenubarMainMenu");
    });

    it("расширяем: новая точка создаётся конструктором", () => {
        const custom = new MenuId("test.customMenu");
        expect(custom.id).toBe("test.customMenu");
        expect(custom).not.toBe(MenuId.EditorContext);
    });

    it("id уникальны: повторное создание с тем же id — ошибка", () => {
        expect(() => new MenuId("EditorContext")).toThrow(/уже существует/);
    });
});
