import * as pty from "node-pty";

import { AnsiScreen } from "./AnsiScreen.ts";
import { getBinaryPath } from "./buildOnce.ts";

export interface VexxSessionOptions {
    args: string[];
    cols?: number;
    rows?: number;
    env?: Record<string, string>;
}

/**
 * Wraps a `node-pty` spawn of the SEA binary, accumulates stdout for ANSI
 * parsing and provides convenience methods for e2e assertions.
 */
export class VexxSession {
    public readonly cols: number;
    public readonly rows: number;
    private readonly term: pty.IPty;
    private buffer = "";
    private exited = false;
    private exitCode: number | null = null;
    private readonly waiters: Array<() => void> = [];

    public static async start(options: VexxSessionOptions): Promise<VexxSession> {
        const binary = await getBinaryPath();
        const cols = options.cols ?? 120;
        const rows = options.rows ?? 32;
        const env: Record<string, string> = {
            ...filterEnv(process.env),
            ...(options.env ?? {}),
            TERM: "xterm-256color",
        };
        // TMUX wrapping kicks in when $TMUX is set — strip it for predictable output.
        delete env.TMUX;
        const term = pty.spawn(binary, options.args, {
            name: "xterm-256color",
            cols,
            rows,
            env,
        });
        const session = new VexxSession(term, cols, rows);
        // On Windows, ConPTY may inject escape sequences during PTY initialization
        // that clear the app's rendered output. Force a resize cycle so the app
        // resets prevGrid and does a full redraw after any such injections.
        if (process.platform === "win32") {
            await sleep(300);
            term.resize(cols, rows + 1);
            await sleep(150);
            term.resize(cols, rows);
        }
        return session;
    }

    private constructor(term: pty.IPty, cols: number, rows: number) {
        this.term = term;
        this.cols = cols;
        this.rows = rows;
        this.term.onData((data) => {
            this.buffer += data;
            for (const w of this.waiters.splice(0)) w();
        });
        this.term.onExit(({ exitCode }) => {
            this.exited = true;
            this.exitCode = exitCode;
            for (const w of this.waiters.splice(0)) w();
        });
    }

    public get isExited(): boolean {
        return this.exited;
    }

    public get code(): number | null {
        return this.exitCode;
    }

    public getRawOutput(): string {
        return this.buffer;
    }

    public parseScreen(): AnsiScreen {
        const screen = new AnsiScreen(this.cols, this.rows);
        screen.feed(this.buffer);
        return screen;
    }

    public write(input: string): void {
        if (!this.exited) this.term.write(input);
    }

    /**
     * Resolves once `predicate(parsedScreen)` returns true AND there are no new
     * bytes for `stableMs`. Throws on timeout.
     */
    public async waitFor(
        predicate: (screen: AnsiScreen) => boolean,
        opts: { timeoutMs?: number; stableMs?: number } = {},
    ): Promise<AnsiScreen> {
        const timeoutMs = opts.timeoutMs ?? 10_000;
        const stableMs = opts.stableMs ?? 150;
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            const screen = this.parseScreen();
            if (predicate(screen)) {
                // Wait for quiescence to make sure the frame is fully flushed.
                const sizeBefore = this.buffer.length;
                await sleep(stableMs);
                if (this.buffer.length === sizeBefore) {
                    return this.parseScreen();
                }
                continue;
            }
            await this.waitForData(Math.max(50, deadline - Date.now()));
        }
        throw new Error(
            `waitFor timed out after ${String(timeoutMs)}ms.\n--- screen ---\n${this.parseScreen().toString()}\n--- raw (last 500 chars) ---\n${JSON.stringify(this.buffer.slice(-500))}`,
        );
    }

    private waitForData(timeoutMs: number): Promise<void> {
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                resolve();
            };
            this.waiters.push(finish);
            setTimeout(finish, timeoutMs);
        });
    }

    /** Send Ctrl+C and wait for process exit (or kill after fallback timeout). */
    public async dispose(graceMs = 2000): Promise<void> {
        if (!this.exited) {
            try {
                this.term.write("\x03");
            } catch {
                // ignore
            }
            await this.waitForExit(graceMs);
        }
        if (!this.exited) {
            try {
                this.term.kill("SIGTERM");
            } catch {
                // ignore
            }
            await this.waitForExit(500);
        }
        if (!this.exited) {
            try {
                this.term.kill("SIGKILL");
            } catch {
                // ignore
            }
            await this.waitForExit(1000);
        }
    }

    public waitForExit(timeoutMs: number): Promise<void> {
        return new Promise((resolve) => {
            if (this.exited) {
                resolve();
                return;
            }
            const finish = () => {
                resolve();
            };
            this.waiters.push(finish);
            setTimeout(finish, timeoutMs);
        });
    }
}

function filterEnv(source: NodeJS.ProcessEnv): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(source)) {
        if (value !== undefined) out[key] = value;
    }
    return out;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
