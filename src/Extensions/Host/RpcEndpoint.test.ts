import { describe, expect, it, vi } from "vitest";

import type { ILogger } from "../../Common/Logging/ILogger.ts";

import { createInProcessChannelPair } from "./InProcessChannelPair.ts";
import { RpcEndpoint } from "./RpcEndpoint.ts";

function makeSpyLogger(): ILogger {
    return {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        isEnabled: () => true,
    };
}

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

    it("swallows a throwing notification handler but logs a warning", async () => {
        const [chA, chB] = createInProcessChannelPair();
        const a = new RpcEndpoint(chA);
        const logger = makeSpyLogger();
        const b = new RpcEndpoint(chB, logger);
        b.handleNotification("event", () => {
            throw new Error("handler blew up");
        });
        // Must not reject or throw — notifications have no response channel.
        a.notify("event", { x: 1 });
        await Promise.resolve();
        await Promise.resolve();
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("notification handler"),
            expect.any(Error),
        );
        a.dispose();
        b.dispose();
        chA.dispose();
        chB.dispose();
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

    it("rejects a request issued AFTER dispose without sending it (line 64)", async () => {
        const [chA] = createInProcessChannelPair();
        const a = new RpcEndpoint(chA);
        a.dispose();
        await expect(a.request("late")).rejects.toThrow(/disposed; cannot request "late"/);
        chA.dispose();
    });

    describe("traceIncoming logging branches (lines 194-219)", () => {
        it("traces an incoming request and a successful response", async () => {
            const [chA, chB] = createInProcessChannelPair();
            const hostLogger = makeSpyLogger();
            const runtimeLogger = makeSpyLogger();
            const a = new RpcEndpoint(chA, hostLogger);
            const b = new RpcEndpoint(chB, runtimeLogger);

            b.handleRequest("echo", (p) => p);
            await a.request("echo", { v: 1 });

            // runtime saw an incoming request
            expect(runtimeLogger.trace).toHaveBeenCalledWith(expect.stringContaining("<- req#"), { v: 1 });
            // host saw an incoming successful response
            expect(hostLogger.trace).toHaveBeenCalledWith(expect.stringMatching(/<- res#\d+/), { v: 1 });

            a.dispose();
            b.dispose();
            chA.dispose();
            chB.dispose();
        });

        it("traces an incoming error-response", async () => {
            const [chA, chB] = createInProcessChannelPair();
            const hostLogger = makeSpyLogger();
            const a = new RpcEndpoint(chA, hostLogger);
            const b = new RpcEndpoint(chB);

            b.handleRequest("boom", () => {
                throw new Error("kaboom");
            });
            await expect(a.request("boom")).rejects.toThrow("kaboom");

            expect(hostLogger.trace).toHaveBeenCalledWith(expect.stringContaining("ERROR: kaboom"));

            a.dispose();
            b.dispose();
            chA.dispose();
            chB.dispose();
        });

        it("traces an incoming notification", async () => {
            const [chA, chB] = createInProcessChannelPair();
            const runtimeLogger = makeSpyLogger();
            const a = new RpcEndpoint(chA);
            const b = new RpcEndpoint(chB, runtimeLogger);

            b.handleNotification("hello", () => undefined);
            a.notify("hello", { x: 9 });
            await Promise.resolve();
            await Promise.resolve();

            expect(runtimeLogger.trace).toHaveBeenCalledWith(expect.stringContaining("<- notif hello"), { x: 9 });

            a.dispose();
            b.dispose();
            chA.dispose();
            chB.dispose();
        });

        it("ignores messages with an unknown kind (default branch)", async () => {
            const [chA, chB] = createInProcessChannelPair();
            const logger = makeSpyLogger();
            const a = new RpcEndpoint(chA, logger);
            const b = new RpcEndpoint(chB);

            chB.postMessage({ kind: "bogus", id: 1 });
            await Promise.resolve();
            await Promise.resolve();

            const calls = (logger.trace as ReturnType<typeof vi.fn>).mock.calls;
            expect(calls.every((c) => !String(c[0]).includes("bogus"))).toBe(true);

            a.dispose();
            b.dispose();
            chA.dispose();
            chB.dispose();
        });
    });
});
