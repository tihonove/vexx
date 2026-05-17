import { describe, expect, it } from "vitest";

import { createInProcessChannelPair } from "./InProcessChannelPair.ts";

describe("InProcessChannelPair", () => {
    it("delivers messages asynchronously from a to b", async () => {
        const [a, b] = createInProcessChannelPair();
        const received: unknown[] = [];
        b.onMessage((m) => received.push(m));
        a.postMessage({ hello: "world" });
        expect(received).toHaveLength(0); // не синхронно
        await Promise.resolve();
        expect(received).toEqual([{ hello: "world" }]);
        a.dispose();
        b.dispose();
    });

    it("delivers messages in both directions", async () => {
        const [a, b] = createInProcessChannelPair();
        const fromA: unknown[] = [];
        const fromB: unknown[] = [];
        a.onMessage((m) => fromB.push(m));
        b.onMessage((m) => fromA.push(m));
        a.postMessage(1);
        b.postMessage(2);
        await new Promise((r) => {
            queueMicrotask(() => {
                r(undefined);
            });
        });
        expect(fromA).toEqual([1]);
        expect(fromB).toEqual([2]);
    });

    it("preserves order of multiple messages", async () => {
        const [a, b] = createInProcessChannelPair();
        const received: unknown[] = [];
        b.onMessage((m) => received.push(m));
        a.postMessage("a");
        a.postMessage("b");
        a.postMessage("c");
        await new Promise((r) => {
            queueMicrotask(() => {
                r(undefined);
            });
        });
        expect(received).toEqual(["a", "b", "c"]);
    });

    it("structurally clones (mutating sender's object does not affect receiver)", async () => {
        const [a, b] = createInProcessChannelPair();
        let received: { v: number } | null = null;
        b.onMessage((m) => {
            received = m as { v: number };
        });
        const payload = { v: 1 };
        a.postMessage(payload);
        payload.v = 999;
        await Promise.resolve();
        expect(received).toEqual({ v: 1 });
    });

    it("unsubscribed listener stops receiving", async () => {
        const [a, b] = createInProcessChannelPair();
        const received: unknown[] = [];
        const sub = b.onMessage((m) => received.push(m));
        a.postMessage(1);
        await Promise.resolve();
        sub.dispose();
        a.postMessage(2);
        await Promise.resolve();
        expect(received).toEqual([1]);
    });

    it("after dispose, postMessage is a no-op and listeners are not invoked", async () => {
        const [a, b] = createInProcessChannelPair();
        const received: unknown[] = [];
        b.onMessage((m) => received.push(m));
        b.dispose();
        a.postMessage("hello");
        await Promise.resolve();
        expect(received).toEqual([]);
    });
});
