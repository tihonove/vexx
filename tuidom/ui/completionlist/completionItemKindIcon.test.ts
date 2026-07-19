import { describe, expect, it } from "vitest";

import { kindIcon } from "./completionItemKindIcon.ts";

describe("kindIcon", () => {
    it("возвращает непустой глиф для известных kind", () => {
        for (let kind = 0; kind <= 24; kind++) {
            expect(kindIcon(kind).length).toBeGreaterThan(0);
        }
    });

    it("разные kind дают разные глифы (property ≠ keyword)", () => {
        expect(kindIcon(9)).not.toBe(kindIcon(13));
    });

    it("undefined и неизвестный kind → дефолтная иконка", () => {
        const def = kindIcon(undefined);
        expect(def.length).toBeGreaterThan(0);
        expect(kindIcon(999)).toBe(def);
    });
});
