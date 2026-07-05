import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { IDisposable } from "../../Common/Disposable.ts";

import { ExtensionHost } from "./ExtensionHost.ts";
import { NULL_COMMAND_SERVICE } from "./ICommandService.ts";
import type { IEditorOptionsPatch, IEditorOptionsService, IEditorOptionsState } from "./IEditorOptionsService.ts";
import type { IExtensionRegistration } from "./IExtensionEntry.ts";
import type { IProtocolMessage, IRequestMessage } from "./RpcEndpoint.ts";

// `spawn` is the only side effect we need to control; everything else (IPC channel,
// RPC endpoint) runs for real against the in-memory FakeChild below.
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
const { spawn } = await import("node:child_process");
const spawnMock = vi.mocked(spawn);

/** A minimal in-memory stand-in for a forked ChildProcess speaking the RPC envelope protocol. */
class FakeChild extends EventEmitter {
    public exitCode: number | null = null;
    public killed = false;
    public stdout: FakeStream | null = null;
    public stderr: FakeStream | null = null;
    public readonly sent: IProtocolMessage[] = [];
    public readonly signals: string[] = [];

    /** When true, auto-replies to host→child requests with a `res` envelope. */
    public autoRespond = true;
    /** Optional override: simulate the child exiting in response to a SIGTERM/SIGKILL. */
    public exitOnSignal: string | null = null;
    /** Optional override: simulate the child exiting when it receives `host.shutdown`. */
    public exitOnShutdown = false;

    public send(message: IProtocolMessage): boolean {
        this.sent.push(message);
        if (message.kind === "req" && this.autoRespond) {
            const isShutdown = message.method === "host.shutdown";
            queueMicrotask(() => {
                this.emit("message", { kind: "res", id: message.id, result: null });
                if (isShutdown && this.exitOnShutdown) this.simulateExit(0);
            });
        }
        return true;
    }

    public kill(signal?: string): boolean {
        this.signals.push(signal ?? "SIGTERM");
        this.killed = true;
        if (this.exitOnSignal !== null && (signal ?? "SIGTERM") === this.exitOnSignal) {
            this.simulateExit(0, signal ?? null);
        }
        return true;
    }

    /** Simulate the subprocess announcing readiness. */
    public emitReady(): void {
        this.emit("message", { kind: "notif", method: "host.ready", params: undefined });
    }

    /** Simulate the subprocess sending a request/notification to the host. */
    public receiveFromHostPeer(message: IProtocolMessage): void {
        this.emit("message", message);
    }

    public simulateExit(code: number | null, signal: string | null = null): void {
        this.exitCode = code;
        this.emit("exit", code, signal);
    }
}

class FakeStream extends EventEmitter {
    public encoding: string | null = null;
    public setEncoding(enc: string): this {
        this.encoding = enc;
        return this;
    }
}

class FakeEditorOptions implements IEditorOptionsService {
    public options: IEditorOptionsState | null = { tabSize: 4, insertSpaces: true };
    public lastPatch: IEditorOptionsPatch | null = null;
    public filePath: string | null = "/active.ts";
    private cb: ((p: string | null) => void) | null = null;

    public getActiveEditorOptions(): IEditorOptionsState | null {
        return this.options;
    }
    public setActiveEditorOptions(patch: IEditorOptionsPatch): void {
        this.lastPatch = patch;
    }
    public getActiveEditorFilePath(): string | null {
        return this.filePath;
    }
    public onActiveEditorChanged(cb: (p: string | null) => void): IDisposable {
        this.cb = cb;
        return {
            dispose: (): void => {
                this.cb = null;
            },
        };
    }
    public fireActiveEditorChanged(p: string | null): void {
        this.cb?.(p);
    }
}

const spawnArgs = () => ({ command: "node", args: ["host.js"] });

function makeReg(id: string, mainPath: string): IExtensionRegistration {
    return { id, manifest: { name: id, publisher: "test", version: "0.0.1" }, mainPath };
}

function makeLogger() {
    return { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

async function waitUntil(pred: () => boolean, timeoutMs = 2000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (pred()) return;
        await new Promise((r) => setTimeout(r, 5));
    }
    if (!pred()) throw new Error("waitUntil timed out");
}

/** Spawn a host whose subprocess becomes ready on the next microtask. */
function spawnReadyHost(child: FakeChild, editorOptions: FakeEditorOptions, options = {}) {
    spawnMock.mockReturnValue(child as never);
    queueMicrotask(() => {
        child.emitReady();
    });
    return new ExtensionHost(editorOptions, NULL_COMMAND_SERVICE, { spawnArgs, ...options });
}

afterEach(() => {
    spawnMock.mockReset();
});

describe("ExtensionHost — registration lifecycle", () => {
    it("lazily spawns the subprocess and activates an extension", async () => {
        const child = new FakeChild();
        const editorOptions = new FakeEditorOptions();
        const host = spawnReadyHost(child, editorOptions);

        const reg = await host.registerExtension(makeReg("ext.a", "/a.js"));

        expect(spawnMock).toHaveBeenCalledOnce();
        expect(host.hasExtension("ext.a")).toBe(true);
        expect(host.extensionCount).toBe(1);
        // host.activateExtension request was sent to the subprocess
        expect(child.sent.some((m) => m.kind === "req" && m.method === "host.activateExtension")).toBe(true);
        // initial active editor state pushed after ready
        expect(child.sent.some((m) => m.kind === "notif" && m.method === "editor.activeEditorChanged")).toBe(true);

        reg.dispose();
        await waitUntil(() => !host.hasExtension("ext.a"));
        expect(host.hasExtension("ext.a")).toBe(false);
    });

    it("reuses the subprocess for a second extension", async () => {
        const child = new FakeChild();
        const host = spawnReadyHost(child, new FakeEditorOptions());

        await host.registerExtension(makeReg("ext.a", "/a.js"));
        await host.registerExtension(makeReg("ext.b", "/b.js"));

        expect(spawnMock).toHaveBeenCalledOnce();
        expect(host.extensionCount).toBe(2);
    });

    it("rejects a duplicate registration", async () => {
        const child = new FakeChild();
        const host = spawnReadyHost(child, new FakeEditorOptions());
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        await expect(host.registerExtension(makeReg("ext.a", "/a.js"))).rejects.toThrow(/already registered/);
    });

    it("rejects registration after dispose", async () => {
        const child = new FakeChild();
        child.exitOnShutdown = true;
        const host = spawnReadyHost(child, new FakeEditorOptions());
        await host.registerExtension(makeReg("ext.a", "/a.js"));
        host.dispose();

        await expect(host.registerExtension(makeReg("ext.b", "/b.js"))).rejects.toThrow(/disposed/);
    });

    it("unregister is a no-op for an unknown extension", async () => {
        const child = new FakeChild();
        const host = spawnReadyHost(child, new FakeEditorOptions());
        await host.registerExtension(makeReg("ext.a", "/a.js"));
        await expect(host.unregisterExtension("nope")).resolves.toBeUndefined();
    });

    it("registration dispose() is a no-op once the extension is already unregistered", async () => {
        const child = new FakeChild();
        const host = spawnReadyHost(child, new FakeEditorOptions());
        const reg = await host.registerExtension(makeReg("ext.a", "/a.js"));

        await host.unregisterExtension("ext.a");
        expect(host.hasExtension("ext.a")).toBe(false);
        const sentBefore = child.sent.length;

        // The disposable returned by registerExtension must not re-trigger a deactivate.
        reg.dispose();
        await waitUntil(() => true);
        expect(child.sent.length).toBe(sentBefore);
    });

    it("swallows errors from the deactivate request", async () => {
        const child = new FakeChild();
        const logger = makeLogger();
        const host = spawnReadyHost(child, new FakeEditorOptions(), { logger });
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        // Make the next host→child request (deactivate) reject by replying with an error envelope.
        child.autoRespond = false;
        const promise = host.unregisterExtension("ext.a");
        await waitUntil(() => child.sent.some((m) => m.kind === "req" && m.method === "host.deactivateExtension"));
        const req = child.sent.find(
            (m): m is IRequestMessage => m.kind === "req" && m.method === "host.deactivateExtension",
        )!;
        child.receiveFromHostPeer({ kind: "res", id: req.id, error: { message: "boom" } });

        await expect(promise).resolves.toBeUndefined();
        expect(host.hasExtension("ext.a")).toBe(false);
    });
});

describe("ExtensionHost — editor options RPC handlers", () => {
    it("applies a sanitized editor.setOptions patch from the subprocess", async () => {
        const child = new FakeChild();
        const editorOptions = new FakeEditorOptions();
        const host = spawnReadyHost(child, editorOptions);
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        child.receiveFromHostPeer({
            kind: "req",
            id: 100,
            method: "editor.setOptions",
            params: { tabSize: 2, insertSpaces: false, bogus: 1 },
        });

        await waitUntil(() => child.sent.some((m) => m.kind === "res" && m.id === 100));
        expect(editorOptions.lastPatch).toEqual({ tabSize: 2, insertSpaces: false });
    });

    it("sanitizes a non-object editor.setOptions payload into an empty patch", async () => {
        const child = new FakeChild();
        const editorOptions = new FakeEditorOptions();
        const host = spawnReadyHost(child, editorOptions);
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        // params is not an object → sanitizeOptionsPatch returns {}
        child.receiveFromHostPeer({ kind: "req", id: 102, method: "editor.setOptions", params: 42 });

        await waitUntil(() => child.sent.some((m) => m.kind === "res" && m.id === 102));
        expect(editorOptions.lastPatch).toEqual({});
    });

    it("drops invalid tabSize / insertSpaces fields from editor.setOptions", async () => {
        const child = new FakeChild();
        const editorOptions = new FakeEditorOptions();
        const host = spawnReadyHost(child, editorOptions);
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        // tabSize is not a positive finite number and insertSpaces is not a boolean → both dropped.
        child.receiveFromHostPeer({
            kind: "req",
            id: 103,
            method: "editor.setOptions",
            params: { tabSize: -1, insertSpaces: "yes" },
        });

        await waitUntil(() => child.sent.some((m) => m.kind === "res" && m.id === 103));
        expect(editorOptions.lastPatch).toEqual({});
    });

    it("answers editor.getOptions with the current state", async () => {
        const child = new FakeChild();
        const editorOptions = new FakeEditorOptions();
        const host = spawnReadyHost(child, editorOptions);
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        child.receiveFromHostPeer({ kind: "req", id: 101, method: "editor.getOptions", params: undefined });

        await waitUntil(() => child.sent.some((m) => m.kind === "res" && m.id === 101));
        const res = child.sent.find((m) => m.kind === "res" && m.id === 101);
        expect(res).toMatchObject({ result: { tabSize: 4, insertSpaces: true } });
    });

    it("forwards active-editor changes to the subprocess", async () => {
        const child = new FakeChild();
        const editorOptions = new FakeEditorOptions();
        const host = spawnReadyHost(child, editorOptions);
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        editorOptions.fireActiveEditorChanged("/other.ts");

        const notif = child.sent.filter((m) => m.kind === "notif" && m.method === "editor.activeEditorChanged");
        expect(notif.at(-1)).toMatchObject({ params: { fileName: "/other.ts" } });
    });
});

describe("ExtensionHost — stdout/stderr piping", () => {
    it("forwards full lines from stdout/stderr to the loggers", async () => {
        const child = new FakeChild();
        child.stdout = new FakeStream();
        child.stderr = new FakeStream();
        const stdoutLogger = makeLogger();
        const stderrLogger = makeLogger();
        const host = spawnReadyHost(child, new FakeEditorOptions(), { stdoutLogger, stderrLogger });
        await host.registerExtension(makeReg("ext.a", "/a.js"));
        expect(child.stdout.encoding).toBe("utf8");

        child.stdout.emit("data", "hello\nwor");
        child.stdout.emit("data", "ld\n");
        child.stdout.emit("data", "tail-info"); // partial line buffered until end
        child.stdout.emit("end"); // flushes the buffered tail via info
        expect(stdoutLogger.info).toHaveBeenCalledWith("hello");
        expect(stdoutLogger.info).toHaveBeenCalledWith("world");
        expect(stdoutLogger.info).toHaveBeenCalledWith("tail-info");

        child.stderr.emit("data", "oops\ntail-without-newline");
        child.stderr.emit("end"); // flushes the buffered tail
        expect(stderrLogger.warn).toHaveBeenCalledWith("oops");
        expect(stderrLogger.warn).toHaveBeenCalledWith("tail-without-newline");
    });

    it("skips empty lines and does not log when the buffer is empty at end", async () => {
        const child = new FakeChild();
        child.stdout = new FakeStream();
        const stdoutLogger = makeLogger();
        const host = spawnReadyHost(child, new FakeEditorOptions(), { stdoutLogger });
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        // A blank line (leading "\n") produces a zero-length `line` → skipped (line 349 false branch).
        // The trailing "\n" leaves the buffer empty, so `end` logs nothing (line 357 false branch).
        child.stdout.emit("data", "\nreal\n");
        child.stdout.emit("end");

        expect(stdoutLogger.info).toHaveBeenCalledTimes(1);
        expect(stdoutLogger.info).toHaveBeenCalledWith("real");
        expect(stdoutLogger.info).not.toHaveBeenCalledWith("");
    });
});

describe("ExtensionHost — subprocess events", () => {
    it("logs subprocess error events", async () => {
        const child = new FakeChild();
        const logger = makeLogger();
        const host = spawnReadyHost(child, new FakeEditorOptions(), { logger });
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        child.emit("error", new Error("spawn failed"));

        expect(logger.error).toHaveBeenCalledWith("extension host subprocess error", expect.any(Error));
    });

    it("skips signalling when the subprocess has already exited before dispose", async () => {
        const child = new FakeChild();
        const host = spawnReadyHost(child, new FakeEditorOptions());
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        child.simulateExit(0); // subprocess gone before we tear down
        host.dispose();

        await waitUntil(() => child.sent.some((m) => m.kind === "req" && m.method === "host.shutdown"));
        expect(child.signals).toEqual([]); // no SIGTERM/SIGKILL — it was already dead
    });
});

describe("ExtensionHost — readiness failures", () => {
    it("rejects when the subprocess exits before becoming ready", async () => {
        const child = new FakeChild();
        spawnMock.mockReturnValue(child as never);
        queueMicrotask(() => {
            child.simulateExit(1);
        });
        const host = new ExtensionHost(new FakeEditorOptions(), NULL_COMMAND_SERVICE, { spawnArgs });

        await expect(host.registerExtension(makeReg("ext.a", "/a.js"))).rejects.toThrow(/exited before ready/);
    });

    it("rejects when the subprocess does not become ready in time", async () => {
        const child = new FakeChild();
        spawnMock.mockReturnValue(child as never); // never emits ready
        const host = new ExtensionHost(new FakeEditorOptions(), NULL_COMMAND_SERVICE, { spawnArgs, readyTimeoutMs: 20 });

        await expect(host.registerExtension(makeReg("ext.a", "/a.js"))).rejects.toThrow(/did not become ready/);
    });
});

describe("ExtensionHost — shutdown", () => {
    it("shuts down gracefully when the subprocess exits on host.shutdown", async () => {
        const child = new FakeChild();
        child.exitOnShutdown = true;
        const host = spawnReadyHost(child, new FakeEditorOptions());
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        host.dispose();

        await waitUntil(() => child.sent.some((m) => m.kind === "req" && m.method === "host.shutdown"));
        expect(child.signals).toEqual([]); // exited cleanly, no signal needed
        host.dispose(); // idempotent
    });

    it("escalates to SIGTERM when the subprocess ignores host.shutdown but dies on SIGTERM", async () => {
        const child = new FakeChild();
        child.exitOnSignal = "SIGTERM";
        const host = spawnReadyHost(child, new FakeEditorOptions());
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        host.dispose();

        await waitUntil(() => child.signals.includes("SIGTERM"));
        expect(child.signals).not.toContain("SIGKILL");
    });

    it("sends a single SIGTERM when the subprocess ignores both shutdown and the signal", async () => {
        // NOTE: the SIGKILL escalation (ExtensionHost.ts:239-245) is unreachable in practice —
        // child.kill() sets child.killed=true, so the second `!child.killed` guard never passes
        // after SIGTERM. Left uncovered intentionally (latent bug, not forced by a test).
        const child = new FakeChild();
        const host = spawnReadyHost(child, new FakeEditorOptions(), { shutdownTimeoutMs: 10 });
        await host.registerExtension(makeReg("ext.a", "/a.js"));

        host.dispose();

        await waitUntil(() => child.signals.includes("SIGTERM"), 2000);
        expect(child.signals).toEqual(["SIGTERM"]);
    });

    it("disposes cleanly when no subprocess was ever spawned", () => {
        const host = new ExtensionHost(new FakeEditorOptions(), NULL_COMMAND_SERVICE, { spawnArgs });
        expect(() => {
            host.dispose();
        }).not.toThrow();
    });
});
