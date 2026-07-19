import { describe, expect, it } from "vitest";

import { buildCommandsNamespace } from "./commandsNamespace.ts";
import { createInProcessChannelPair } from "./inProcessChannelPair.ts";
import { RpcEndpoint } from "./rpcEndpoint.ts";

const microtasks = async (turns = 4): Promise<void> => {
    for (let i = 0; i < turns; i++) await Promise.resolve();
};

/**
 * Поднимает пару endpoint'ов: `sub` — «subprocess» с commands namespace,
 * `host` — «хост», на котором тест регистрирует хендлеры/наблюдает уведомления.
 */
function createBridge(): {
    commands: ReturnType<typeof buildCommandsNamespace>;
    host: RpcEndpoint;
    dispose: () => void;
} {
    const [chSub, chHost] = createInProcessChannelPair();
    const sub = new RpcEndpoint(chSub);
    const host = new RpcEndpoint(chHost);
    const commands = buildCommandsNamespace(sub);
    return {
        commands,
        host,
        dispose: (): void => {
            sub.dispose();
            host.dispose();
            chSub.dispose();
            chHost.dispose();
        },
    };
}

describe("CommandsNamespace (subprocess)", () => {
    it("executeCommand локальной команды исполняет её без RPC на хост", async () => {
        const { commands, host, dispose } = createBridge();
        let hostSawExecute = false;
        host.handleRequest("commands.executeCommand", () => {
            hostSawExecute = true;
            return null;
        });
        commands.registerCommand("local.sum", (a, b) => (a as number) + (b as number));

        const result = await commands.executeCommand<number>("local.sum", 2, 3);

        expect(result).toBe(5);
        expect(hostSawExecute).toBe(false);
        dispose();
    });

    it("executeCommand неизвестной локально команды уходит request'ом на хост и резолвится результатом", async () => {
        const { commands, host, dispose } = createBridge();
        const received: { id: string; args: unknown[] }[] = [];
        host.handleRequest("commands.executeCommand", (params) => {
            const { id, args } = params as { id: string; args: unknown[] };
            received.push({ id, args });
            return "host-result";
        });

        const result = await commands.executeCommand<string>("core.doThing", 42, "x");

        expect(result).toBe("host-result");
        expect(received).toEqual([{ id: "core.doThing", args: [42, "x"] }]);
        dispose();
    });

    it("registerCommand шлёт notif commands.registerCommand, dispose — commands.unregisterCommand", async () => {
        const { commands, host, dispose } = createBridge();
        const registered: string[] = [];
        const unregistered: string[] = [];
        host.handleNotification("commands.registerCommand", (p) => registered.push((p as { id: string }).id));
        host.handleNotification("commands.unregisterCommand", (p) => unregistered.push((p as { id: string }).id));

        const disposable = commands.registerCommand("ext.foo", () => undefined);
        await microtasks();
        expect(registered).toEqual(["ext.foo"]);
        expect(unregistered).toEqual([]);

        disposable.dispose();
        await microtasks();
        expect(unregistered).toEqual(["ext.foo"]);
        dispose();
    });

    it("dispose первой регистрации не трогает id, перезанятый повторным register", async () => {
        const { commands, host, dispose } = createBridge();
        const unregistered: string[] = [];
        host.handleNotification("commands.unregisterCommand", (p) => unregistered.push((p as { id: string }).id));

        const first = commands.registerCommand("ext.dup", () => "one");
        commands.registerCommand("ext.dup", () => "two"); // перезаписывает bound
        first.dispose(); // get(id) !== bound первого → ничего не снимаем

        await microtasks();
        expect(unregistered).toEqual([]);
        // Команда всё ещё исполняется вторым колбэком.
        await expect(commands.executeCommand<string>("ext.dup")).resolves.toBe("two");
        dispose();
    });

    it("host → subprocess: входящий commands.executeCommand гоняет локальный колбэк с прокинутыми args", async () => {
        const { commands, host, dispose } = createBridge();
        const seen: unknown[][] = [];
        commands.registerCommand("ext.bar", (...args) => {
            seen.push(args);
            return "ran";
        });

        const result = await host.request("commands.executeCommand", { id: "ext.bar", args: [1, 2] });

        expect(result).toBe("ran");
        expect(seen).toEqual([[1, 2]]);
        dispose();
    });

    it("host → subprocess: неизвестная локально команда → reject", async () => {
        const { host, dispose } = createBridge();
        await expect(host.request("commands.executeCommand", { id: "nope", args: [] })).rejects.toThrow(/not found/);
        dispose();
    });

    it("host → subprocess: без массива args колбэк зовётся без аргументов", async () => {
        const { commands, host, dispose } = createBridge();
        const seen: unknown[][] = [];
        commands.registerCommand("ext.noargs", (...args) => {
            seen.push(args);
            return "ok";
        });

        const result = await host.request("commands.executeCommand", { id: "ext.noargs" });

        expect(result).toBe("ok");
        expect(seen).toEqual([[]]);
        dispose();
    });

    it("host → subprocess: некорректные params (не объект) → reject", async () => {
        const { host, dispose } = createBridge();
        await expect(host.request("commands.executeCommand", 42)).rejects.toThrow(/must be an object/);
        dispose();
    });

    it("host → subprocess: пустой id → reject", async () => {
        const { host, dispose } = createBridge();
        await expect(host.request("commands.executeCommand", { id: "" })).rejects.toThrow(/non-empty string/);
        dispose();
    });

    it("executeCommand несуществующей нигде команды reject'ится (хост без хендлера)", async () => {
        const { commands, dispose } = createBridge();
        // host не регистрирует commands.executeCommand → RpcEndpoint вернёт No handler.
        await expect(commands.executeCommand("ghost")).rejects.toThrow();
        dispose();
    });

    it("thisArg привязывается к колбэку", async () => {
        const { commands, dispose } = createBridge();
        const ctx = { value: 7 };
        commands.registerCommand(
            "ext.this",
            function (this: typeof ctx) {
                return this.value;
            },
            ctx,
        );
        const result = await commands.executeCommand<number>("ext.this");
        expect(result).toBe(7);
        dispose();
    });
});
