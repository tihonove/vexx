import { type ChildProcess, spawn } from "node:child_process";

import type WebSocket from "ws";

import type { GridSnapshot } from "../../tuidom/rendering/gridSnapshot.ts";
import type {
    CaptureFrameResult,
    GetDocumentResult,
    InspectorResponse,
    InspectorSuccessResponse,
    NodeSnapshot,
    SendMouseParams,
    WaitForIdleParams,
    WaitForIdleResult,
} from "../../tuidom/inspector/protocol.ts";

import { getBinaryPath } from "./buildOnce.ts";
import { dumpFrame, frameToText } from "./frame.ts";
import { connectWithRetry, freePort } from "./inspectorClient.ts";
import { waitUntil } from "./waitFor.ts";

/** Modifier flags shared by the mouse convenience verbs. */
export type MouseModifiers = Pick<SendMouseParams, "shiftKey" | "altKey" | "ctrlKey">;

/**
 * Опции settle-глаголов (`key`/`text`/`click`/`wheel`/`resize`). `settle: false`
 * отключает авто-ожидание покоя (нужно тестам на гонки); объект — параметры
 * `waitForIdle`.
 */
export type SettleOption = { settle?: boolean | WaitForIdleParams };

export interface HeadlessSessionOptions {
    /** Positional args (files/dirs to open) and any flags except headless/inspect-tui. */
    args?: string[];
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
}

/**
 * Runs the real SEA binary in `--headless` mode (no terminal) and drives it over
 * the inspector WebSocket: inject keys, capture frames. The counterpart of
 * {@link import("./runVexx.ts").VexxSession} for the terminal-less path — no pty,
 * no ANSI parsing, just structured frame snapshots.
 */
export class HeadlessSession {
    public readonly cols: number;
    public readonly rows: number;
    private readonly child: ChildProcess;
    private readonly ws: WebSocket;
    private nextId = 1;
    private readonly pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();
    private stderr = "";

    public static async start(options: HeadlessSessionOptions = {}): Promise<HeadlessSession> {
        const binary = await getBinaryPath();
        const cols = options.cols ?? 140;
        const rows = options.rows ?? 38;
        const port = await freePort();
        const args = [
            ...(options.args ?? []),
            `--headless=${String(cols)}x${String(rows)}`,
            `--inspect-tui=127.0.0.1:${String(port)}`,
        ];
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
        Object.assign(env, options.env ?? {});

        const child = spawn(binary, args, {
            stdio: ["ignore", "ignore", "pipe"],
            ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
            env,
        });
        const session = new HeadlessSession(child, cols, rows, await connectWithRetry(`ws://127.0.0.1:${String(port)}`, 30_000));
        return session;
    }

    private constructor(child: ChildProcess, cols: number, rows: number, ws: WebSocket) {
        this.child = child;
        this.cols = cols;
        this.rows = rows;
        this.ws = ws;
        this.child.stderr?.on("data", (chunk: Buffer) => {
            this.stderr += chunk.toString();
        });
        this.ws.on("message", (data: WebSocket.RawData) => {
            const res = JSON.parse(data.toString()) as InspectorResponse;
            const waiter = this.pending.get(res.id);
            if (waiter === undefined) return;
            this.pending.delete(res.id);
            if ("error" in res) waiter.reject(new Error(res.error.message));
            else waiter.resolve((res as InspectorSuccessResponse).result);
        });
    }

    private rpc<T>(method: string, params?: unknown): Promise<T> {
        const id = this.nextId++;
        return new Promise<T>((resolve, reject) => {
            this.pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    // ─── Raw injection (no settling; for race tests) ───

    /** Inject a key by DSL name without waiting for the render to settle. */
    public async sendKey(name: string): Promise<void> {
        await this.rpc("TUIDom.sendKey", { name });
    }

    /** Inject literal text without waiting for the render to settle. */
    public async sendText(text: string): Promise<void> {
        await this.rpc("TUIDom.sendText", { text });
    }

    /**
     * Inject a mouse event at 0-based screen coordinates — the same frame of
     * reference as a node's `box` in `TUIDom.getDocument`. No settling.
     */
    public async sendMouse(params: SendMouseParams): Promise<void> {
        await this.rpc("TUIDom.sendMouse", params);
    }

    // ─── Settling verbs (inject, then wait for the render to settle) ───

    /**
     * Block until the app stops repainting (frame counter stable + no scheduled
     * render). The server-side counterpart of a `sleep`, but deterministic.
     * Note: settles the *render*, not async tails (ext-host, StateService
     * debounce) — for those poll a predicate ({@link waitForDocument} etc.).
     */
    public async waitForIdle(opts: WaitForIdleParams = {}): Promise<WaitForIdleResult> {
        return this.rpc<WaitForIdleResult>("TUIDom.waitForIdle", opts);
    }

    /** Resolve the {@link SettleOption} into an actual settle (or skip it). */
    private async settle(opt: SettleOption): Promise<void> {
        if (opt.settle === false) return;
        await this.waitForIdle(typeof opt.settle === "object" ? opt.settle : {});
    }

    /** Inject a key by DSL name, then wait for the render to settle. */
    public async key(name: string, opts: SettleOption = {}): Promise<void> {
        await this.sendKey(name);
        await this.settle(opts);
    }

    /** Inject literal text as a paste, then wait for the render to settle. */
    public async text(value: string, opts: SettleOption = {}): Promise<void> {
        await this.sendText(value);
        await this.settle(opts);
    }

    /** Press and release the left button on a cell, then settle. */
    public async click(x: number, y: number, opts: MouseModifiers & SettleOption = {}): Promise<void> {
        const { settle, ...mods } = opts;
        await this.sendMouse({ action: "press", button: "left", x, y, ...mods });
        await this.sendMouse({ action: "release", button: "left", x, y, ...mods });
        await this.settle({ settle });
    }

    /** Spin the wheel over a cell (`direction` matches DOM `wheelDirection`), then settle. */
    public async wheel(x: number, y: number, direction: "up" | "down" | "left" | "right", opts: SettleOption = {}): Promise<void> {
        await this.sendMouse({ action: `scroll-${direction}`, x, y });
        await this.settle(opts);
    }

    /** Resize the virtual terminal, then settle. */
    public async resize(cols: number, rows: number, opts: SettleOption = {}): Promise<void> {
        await this.rpc("TUIDom.resize", { cols, rows });
        await this.settle(opts);
    }

    public async captureFrame(): Promise<GridSnapshot> {
        return (await this.rpc<CaptureFrameResult>("TUIDom.captureFrame")).frame;
    }

    /** Snapshot of the element tree — node boxes are the coordinates {@link click} takes. */
    public async getDocument(): Promise<GetDocumentResult> {
        return this.rpc<GetDocumentResult>("TUIDom.getDocument");
    }

    /** Poll `getDocument` until `predicate(root)` holds; returns the matching root. */
    public async waitForDocument(
        predicate: (root: NodeSnapshot) => boolean,
        opts: { timeoutMs?: number; intervalMs?: number } = {},
    ): Promise<NodeSnapshot> {
        const root = await waitUntil(
            async () => (await this.getDocument()).root,
            (r): r is NodeSnapshot => r !== null && predicate(r),
            {
                ...opts,
                describe: "document predicate",
                diagnose: (last) => `last root: ${last === null ? "<null>" : (last as NodeSnapshot).type}`,
            },
        );
        return root as NodeSnapshot;
    }

    /** Poll `captureFrame` until `predicate(text)` holds on the rendered screen. */
    public async waitForText(
        predicate: (text: string) => boolean,
        opts: { timeoutMs?: number; intervalMs?: number } = {},
    ): Promise<GridSnapshot> {
        return waitUntil(() => this.captureFrame(), (frame) => predicate(frameToText(frame)), {
            intervalMs: 150,
            ...opts,
            describe: "screen text predicate",
            diagnose: (last) => `--- last frame ---\n${dumpFrame(last as GridSnapshot)}`,
        });
    }

    public async dispose(): Promise<void> {
        try {
            await this.rpc("TUIDom.shutdown");
        } catch {
            // socket may drop as the process exits — ignore
        }
        try {
            this.ws.close();
        } catch {
            // already closed
        }
        if (this.child.exitCode === null) this.child.kill("SIGKILL");
    }

    /** Captured stderr (diagnostics only — headless writes nothing there normally). */
    public getStderr(): string {
        return this.stderr;
    }
}

// Реэкспорт для существующих потребителей текста кадра.
export { dumpFrame, frameToText };
