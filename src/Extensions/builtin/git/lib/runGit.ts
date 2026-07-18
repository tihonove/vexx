import { spawn } from "node:child_process";

/** Options for {@link runGit}. All optional — the defaults suit a one-shot query. */
export interface IRunGitOptions {
    /** Working directory to run `git` in (the repository root, usually). */
    cwd?: string;
    /** Hard timeout in ms; the child is SIGKILL'd if it outlives it. Default 30s. */
    timeoutMs?: number;
    /** Extra environment for the child. Defaults to the parent process env. */
    env?: NodeJS.ProcessEnv;
}

/** A completed `git` invocation — resolved regardless of the exit code. */
export interface IRunGitResult {
    /** Process exit code, or `-1` when the child was killed (timeout/signal). */
    code: number;
    stdout: string;
    stderr: string;
}

/** A failed *spawn* — the `git` binary was missing or could not be started. */
export interface IRunGitError {
    error: Error;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * In-flight de-duplication: identical invocations (same cwd + args) share one
 * subprocess and one promise. Cleared as soon as the invocation settles.
 */
const inFlight = new Map<string, Promise<IRunGitResult | IRunGitError>>();

/**
 * Run `git` with the given argv, never rejecting.
 *
 * - A failure to *spawn* (e.g. `git` not on PATH → ENOENT) resolves to `{ error }`.
 * - A non-zero exit (not a repo, degraded state, …) resolves to `{ code, stdout, stderr }`
 *   just like a success — callers branch on `code`, not on rejection.
 * - The child is killed if it outlives `timeoutMs`; that resolves with `code === -1`.
 *
 * Concurrent identical calls are de-duplicated by `(cwd, args)`.
 */
export function runGit(args: string[], opts: IRunGitOptions = {}): Promise<IRunGitResult | IRunGitError> {
    const key = JSON.stringify([opts.cwd ?? "", args]);
    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = spawnGit(args, opts).finally(() => {
        inFlight.delete(key);
    });
    inFlight.set(key, promise);
    return promise;
}

function spawnGit(args: string[], opts: IRunGitOptions): Promise<IRunGitResult | IRunGitError> {
    return new Promise((resolve) => {
        const child = spawn("git", args, { cwd: opts.cwd, env: opts.env });

        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let settled = false;

        const timer = setTimeout(() => {
            child.kill("SIGKILL");
        }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

        const finish = (value: IRunGitResult | IRunGitError): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        };

        child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

        child.on("error", (error) => {
            finish({ error });
        });
        child.on("close", (code) => {
            finish({
                code: code ?? -1,
                stdout: Buffer.concat(stdout).toString("utf8"),
                stderr: Buffer.concat(stderr).toString("utf8"),
            });
        });
    });
}
