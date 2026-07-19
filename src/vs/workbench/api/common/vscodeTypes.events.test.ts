import { describe, expect, it, vi } from "vitest";

import { DisposableImpl, EventEmitter } from "./vscodeTypes.ts";

describe("VscodeTypes — EventEmitter", () => {
    it("fire доставляет данные всем слушателям", () => {
        const em = new EventEmitter<number>();
        const seen: number[] = [];
        em.event((n) => seen.push(n));
        em.event((n) => seen.push(n * 10));
        em.fire(3);
        expect(seen).toEqual([3, 30]);
    });

    it("dispose подписки прекращает доставку", () => {
        const em = new EventEmitter<number>();
        const seen: number[] = [];
        const sub = em.event((n) => seen.push(n));
        em.fire(1);
        sub.dispose();
        em.fire(2);
        expect(seen).toEqual([1]);
    });

    it("thisArgs привязывается", () => {
        const em = new EventEmitter<void>();
        const ctx = { hit: false };
        em.event(function (this: typeof ctx) {
            this.hit = true;
        }, ctx);
        em.fire();
        expect(ctx.hit).toBe(true);
    });

    it("disposables-массив получает подписку", () => {
        const em = new EventEmitter<void>();
        const bag: DisposableImpl[] = [];
        em.event(() => undefined, undefined, bag);
        expect(bag).toHaveLength(1);
    });

    it("отписка слушателя во время fire не ломает текущий проход", () => {
        const em = new EventEmitter<void>();
        const seen: string[] = [];
        const sub = em.event(() => {
            seen.push("a");
            sub.dispose();
        });
        em.event(() => seen.push("b"));
        em.fire();
        expect(seen).toEqual(["a", "b"]);
    });

    it("падение одного слушателя не валит fire", () => {
        const em = new EventEmitter<void>();
        const seen: string[] = [];
        em.event(() => {
            throw new Error("boom");
        });
        em.event(() => seen.push("ok"));
        expect(() => {
            em.fire();
        }).not.toThrow();
        expect(seen).toEqual(["ok"]);
    });

    it("повторный dispose подписки безопасен (idx<0)", () => {
        const em = new EventEmitter<number>();
        const sub = em.event(() => undefined);
        sub.dispose();
        expect(() => {
            sub.dispose();
        }).not.toThrow();
    });

    it("emitter.dispose() очищает всех слушателей", () => {
        const em = new EventEmitter<number>();
        const seen: number[] = [];
        em.event((n) => seen.push(n));
        em.dispose();
        em.fire(5);
        expect(seen).toEqual([]);
    });
});

describe("VscodeTypes — DisposableImpl", () => {
    it("dispose вызывает колбэк", () => {
        const cb = vi.fn();
        new DisposableImpl(cb).dispose();
        expect(cb).toHaveBeenCalledTimes(1);
    });

    it("from агрегирует и диспозит все", () => {
        const a = vi.fn();
        const b = vi.fn();
        DisposableImpl.from({ dispose: a }, { dispose: b }).dispose();
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
    });
});
