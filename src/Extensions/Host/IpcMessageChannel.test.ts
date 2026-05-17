import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import type { IIpcEndpoint } from "./IpcMessageChannel.ts";
import { IpcMessageChannel } from "./IpcMessageChannel.ts";

/**
 * Стаб IPC-endpoint поверх двух связанных EventEmitter'ов: что отправлено
 * через `send`, эмитится как `'message'` на peer'е (асинхронно, как реальный
 * Node IPC).
 */
class FakeIpcEndpoint extends EventEmitter implements IIpcEndpoint {
    public peer: FakeIpcEndpoint | null = null;
    public sent: unknown[] = [];
    public dead = false;

    public send(message: unknown): boolean {
        if (this.dead) return false;
        this.sent.push(message);
        const peer = this.peer;
        if (peer === null) return false;
        // JSON round-trip имитирует structured clone Node IPC.
        const serialized = JSON.stringify(message);
        queueMicrotask(() => {
            if (peer.dead) return;
            peer.emit("message", JSON.parse(serialized));
        });
        return true;
    }

    public kill(): void {
        this.dead = true;
        this.emit("disconnect");
    }
}

function pair(): [FakeIpcEndpoint, FakeIpcEndpoint] {
    const a = new FakeIpcEndpoint();
    const b = new FakeIpcEndpoint();
    a.peer = b;
    b.peer = a;
    return [a, b];
}

describe("IpcMessageChannel", () => {
    it("доставляет сообщения a -> b асинхронно", async () => {
        const [a, b] = pair();
        const chA = new IpcMessageChannel(a);
        const chB = new IpcMessageChannel(b);
        const received: unknown[] = [];
        chB.onMessage((m) => received.push(m));
        chA.postMessage({ hello: "world" });
        expect(received).toHaveLength(0);
        await Promise.resolve();
        expect(received).toEqual([{ hello: "world" }]);
        chA.dispose();
        chB.dispose();
    });

    it("работает в обе стороны и сохраняет порядок", async () => {
        const [a, b] = pair();
        const chA = new IpcMessageChannel(a);
        const chB = new IpcMessageChannel(b);
        const fromA: unknown[] = [];
        const fromB: unknown[] = [];
        chA.onMessage((m) => fromB.push(m));
        chB.onMessage((m) => fromA.push(m));
        chA.postMessage("a1");
        chA.postMessage("a2");
        chB.postMessage("b1");
        await new Promise((r) => {
            queueMicrotask(() => {
                r(undefined);
            });
        });
        expect(fromA).toEqual(["a1", "a2"]);
        expect(fromB).toEqual(["b1"]);
        chA.dispose();
        chB.dispose();
    });

    it("после dispose postMessage не доходит и listener'ы не дёргаются", async () => {
        const [a, b] = pair();
        const chA = new IpcMessageChannel(a);
        const chB = new IpcMessageChannel(b);
        const received: unknown[] = [];
        chB.onMessage((m) => received.push(m));
        chB.dispose();
        chA.postMessage("hi");
        await Promise.resolve();
        expect(received).toEqual([]);
        chA.dispose();
    });

    it("отписанный listener больше не получает", async () => {
        const [a, b] = pair();
        const chA = new IpcMessageChannel(a);
        const chB = new IpcMessageChannel(b);
        const received: unknown[] = [];
        const sub = chB.onMessage((m) => received.push(m));
        chA.postMessage(1);
        await Promise.resolve();
        sub.dispose();
        chA.postMessage(2);
        await Promise.resolve();
        expect(received).toEqual([1]);
        chA.dispose();
        chB.dispose();
    });

    it("после события disconnect postMessage no-op", () => {
        const [a, b] = pair();
        const chA = new IpcMessageChannel(a);
        const chB = new IpcMessageChannel(b);
        const sendSpy = vi.spyOn(a, "send");
        b.kill(); // эмитим disconnect на endpoint a? нет, на b. отдельно:
        a.emit("disconnect");
        chA.postMessage("dropped");
        expect(sendSpy).not.toHaveBeenCalled();
        chA.dispose();
        chB.dispose();
    });

    it("dispose снимает подписки c endpoint'а", () => {
        const [a] = pair();
        const ch = new IpcMessageChannel(a);
        expect(a.listenerCount("message")).toBe(1);
        expect(a.listenerCount("disconnect")).toBe(1);
        ch.dispose();
        expect(a.listenerCount("message")).toBe(0);
        expect(a.listenerCount("disconnect")).toBe(0);
    });

    it("исключение в endpoint.send не падает наружу", () => {
        const [a, b] = pair();
        const chA = new IpcMessageChannel(a);
        const chB = new IpcMessageChannel(b);
        a.send = (): boolean => {
            throw new Error("EPIPE");
        };
        expect(() => {
            chA.postMessage("x");
        }).not.toThrow();
        chA.dispose();
        chB.dispose();
    });
});
