import { describe, expect, it } from "vitest";

import { createInProcessChannelPair } from "./InProcessChannelPair.ts";
import { RpcEndpoint } from "./RpcEndpoint.ts";

function createEndpointPair(): { a: RpcEndpoint; b: RpcEndpoint; dispose: () => void } {
    const [chA, chB] = createInProcessChannelPair();
    const a = new RpcEndpoint(chA);
    const b = new RpcEndpoint(chB);
    return {
        a,
        b,
        dispose: (): void => {
            a.dispose();
            b.dispose();
            chA.dispose();
            chB.dispose();
        },
    };
}

describe("RpcEndpoint", () => {
    it("request resolves with handler's result", async () => {
        const { a, b, dispose } = createEndpointPair();
        b.handleRequest("echo", (params) => params);
        const result = await a.request("echo", { hi: 1 });
        expect(result).toEqual({ hi: 1 });
        dispose();
    });

    it("request to unknown method rejects with no-handler error", async () => {
        const { a, dispose } = createEndpointPair();
        await expect(a.request("missing")).rejects.toThrow(/No handler/);
        dispose();
    });

    it("propagates handler errors via rejected promise", async () => {
        const { a, b, dispose } = createEndpointPair();
        b.handleRequest("boom", () => {
            throw new Error("nope");
        });
        await expect(a.request("boom")).rejects.toThrow("nope");
        dispose();
    });

    it("notify delivers without response", async () => {
        const { a, b, dispose } = createEndpointPair();
        const received: unknown[] = [];
        b.handleNotification("event", (params) => received.push(params));
        a.notify("event", { x: 1 });
        await Promise.resolve();
        await Promise.resolve();
        expect(received).toEqual([{ x: 1 }]);
        dispose();
    });

    it("supports concurrent requests with distinct ids", async () => {
        const { a, b, dispose } = createEndpointPair();
        b.handleRequest("double", (params) => (params as number) * 2);
        const results = await Promise.all([a.request("double", 1), a.request("double", 2), a.request("double", 3)]);
        expect(results).toEqual([2, 4, 6]);
        dispose();
    });

    it("dispose rejects pending requests", async () => {
        const { a, b, dispose } = createEndpointPair();
        b.handleRequest("never", () => new Promise(() => undefined));
        const pending = a.request("never");
        a.dispose();
        await expect(pending).rejects.toThrow(/disposed/);
        b.dispose();
        dispose();
    });

    it("handler disposable removes the handler", async () => {
        const { a, b, dispose } = createEndpointPair();
        const sub = b.handleRequest("hello", () => "world");
        expect(await a.request("hello")).toBe("world");
        sub.dispose();
        await expect(a.request("hello")).rejects.toThrow(/No handler/);
        dispose();
    });
});
