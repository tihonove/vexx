import { type ChildProcess, spawn } from "node:child_process";

import type WebSocket from "ws";

import type { GridSnapshot } from "../../tuidom/rendering/gridSnapshot.ts";
import type { CaptureFrameResult, InspectorResponse, InspectorSuccessResponse } from "../../tuidom/inspector/protocol.ts";

import { getBinaryPath } from "./buildOnce.ts";
import { connectWithRetry, freePort } from "./inspectorClient.ts";

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

    public async sendKey(name: string): Promise<void> {
        await this.rpc("TUIDom.sendKey", { name });
    }

    public async sendText(text: string): Promise<void> {
        await this.rpc("TUIDom.sendText", { text });
    }

    public async resize(cols: number, rows: number): Promise<void> {
        await this.rpc("TUIDom.resize", { cols, rows });
    }

    public async captureFrame(): Promise<GridSnapshot> {
        return (await this.rpc<CaptureFrameResult>("TUIDom.captureFrame")).frame;
    }

    /** Poll `captureFrame` until `predicate(text)` holds on the rendered screen. */
    public async waitForText(
        predicate: (text: string) => boolean,
        opts: { timeoutMs?: number; intervalMs?: number } = {},
    ): Promise<GridSnapshot> {
        const timeoutMs = opts.timeoutMs ?? 10_000;
        const intervalMs = opts.intervalMs ?? 150;
        const deadline = Date.now() + timeoutMs;
        let last: GridSnapshot | null = null;
        while (Date.now() < deadline) {
            last = await this.captureFrame();
            if (predicate(frameToText(last))) return last;
            await sleep(intervalMs);
        }
        throw new Error(
            `waitForText timed out after ${String(timeoutMs)}ms\n--- last frame ---\n${last === null ? "<none>" : frameToText(last)}`,
        );
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

/** Flatten a captured frame into newline-joined text (trailing blanks trimmed). */
export function frameToText(frame: GridSnapshot): string {
    const lines: string[] = [];
    for (let y = 0; y < frame.rows; y++) {
        let line = "";
        for (let x = 0; x < frame.cols; x++) line += frame.cells[y * frame.cols + x].char;
        lines.push(line.replace(/\s+$/u, ""));
    }
    return lines.join("\n");
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
