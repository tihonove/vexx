import { describe, expect, it } from "vitest";

import { ContextKeyService } from "./ContextKeyService.ts";

describe("ContextKeyService", () => {
    it("returns undefined for unset keys", () => {
        const ctx = new ContextKeyService();
        expect(ctx.get("textInputFocus")).toBeUndefined();
        expect(ctx.get("listFocus")).toBeUndefined();
    });

    it("set and get a key", () => {
        const ctx = new ContextKeyService();
        ctx.set("textInputFocus", true);
        expect(ctx.get("textInputFocus")).toBe(true);
    });

    it("reset removes a key", () => {
        const ctx = new ContextKeyService();
        ctx.set("listFocus", true);
        ctx.reset("listFocus");
        expect(ctx.get("listFocus")).toBeUndefined();
    });

    it("dispose clears all keys", () => {
        const ctx = new ContextKeyService();
        ctx.set("textInputFocus", true);
        ctx.set("listFocus", true);
        ctx.dispose();
        expect(ctx.get("textInputFocus")).toBeUndefined();
        expect(ctx.get("listFocus")).toBeUndefined();
    });

    describe("evaluate", () => {
        it("evaluates simple true key", () => {
            const ctx = new ContextKeyService();
            ctx.set("textInputFocus", true);
            expect(ctx.evaluate("textInputFocus")).toBe(true);
        });

        it("evaluates simple false key", () => {
            const ctx = new ContextKeyService();
            expect(ctx.evaluate("textInputFocus")).toBe(false);
        });

        it("evaluates negation", () => {
            const ctx = new ContextKeyService();
            ctx.set("textInputFocus", true);
            expect(ctx.evaluate("!textInputFocus")).toBe(false);
            expect(ctx.evaluate("!listFocus")).toBe(true);
        });

        it("evaluates && expression", () => {
            const ctx = new ContextKeyService();
            ctx.set("textInputFocus", true);
            ctx.set("listFocus", true);
            expect(ctx.evaluate("textInputFocus && listFocus")).toBe(true);

            ctx.reset("listFocus");
            expect(ctx.evaluate("textInputFocus && listFocus")).toBe(false);
        });

        it("evaluates || expression", () => {
            const ctx = new ContextKeyService();
            ctx.set("textInputFocus", true);
            expect(ctx.evaluate("textInputFocus || listFocus")).toBe(true);
            expect(ctx.evaluate("listFocus || textInputFocus")).toBe(true);

            ctx.reset("textInputFocus");
            expect(ctx.evaluate("textInputFocus || listFocus")).toBe(false);
        });

        it("evaluates complex expression", () => {
            const ctx = new ContextKeyService();
            ctx.set("textInputFocus", true);
            expect(ctx.evaluate("textInputFocus && !listFocus")).toBe(true);
            expect(ctx.evaluate("!textInputFocus || listFocus")).toBe(false);
        });

        it("returns false for invalid expression", () => {
            const ctx = new ContextKeyService();
            expect(ctx.evaluate("???invalid!!!")).toBe(false);
        });
    });
});
