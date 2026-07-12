import { afterEach, describe, expect, it, vi } from "vitest";

import { flushMicrotasks, settle } from "./timing.ts";

describe("flushMicrotasks", () => {
    it("прокачивает цепочку из трёх microtask-оборотов (дефолт)", async () => {
        let done = false;
        void Promise.resolve()
            .then(() => undefined)
            .then(() => undefined)
            .then(() => {
                done = true;
            });
        await flushMicrotasks();
        expect(done).toBe(true);
    });

    it("уважает кастомное число оборотов", async () => {
        let done = false;
        void Promise.resolve().then(() => {
            done = true;
        });
        await flushMicrotasks(1);
        expect(done).toBe(true);
    });
});

describe("settle", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("резолвится после дефолтных 200мс", async () => {
        vi.useFakeTimers();
        let done = false;
        void settle().then(() => {
            done = true;
        });
        await vi.advanceTimersByTimeAsync(199);
        expect(done).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(done).toBe(true);
    });

    it("уважает кастомную задержку", async () => {
        vi.useFakeTimers();
        let done = false;
        void settle(50).then(() => {
            done = true;
        });
        await vi.advanceTimersByTimeAsync(50);
        expect(done).toBe(true);
    });
});
