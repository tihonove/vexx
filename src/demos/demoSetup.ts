/**
 * Shared setup for low-level TUI demos (raw stdin, Kitty protocol).
 *
 * Handles:
 * - Kitty Keyboard Protocol enable/disable
 * - TMUX passthrough
 * - Raw mode setup
 * - Cleanup on exit
 * - Ctrl+C exit
 */

export const stdin = process.stdin;
export const stdout = process.stdout;

// ── Kitty Keyboard Protocol ──────────────────────────────────────
export const KITTY_ENABLE = "\x1b[>11u";
export const KITTY_DISABLE = "\x1b[<u";

const isTmux = process.env.TMUX != null && process.env.TMUX !== "";

export function wrapForTmux(sequence: string): string {
    // eslint-disable-next-line no-control-regex
    const escaped = sequence.replace(/\x1b/g, "\x1b\x1b");
    return `\x1bPtmux;${escaped}\x1b\\`;
}

export function writePassthrough(sequence: string): void {
    stdout.write(isTmux ? wrapForTmux(sequence) : sequence);
}

// ── Setup raw mode + Kitty ───────────────────────────────────────

const extraCleanup: (() => void)[] = [];

export function addCleanup(fn: () => void): void {
    extraCleanup.push(fn);
}

export function cleanup(): void {
    for (const fn of extraCleanup) fn();
    writePassthrough(KITTY_DISABLE);
    stdin.setRawMode(false);
}

/** Returns true if the event is Ctrl+C (check before processing other events). */
export function isCtrlC(ctrlKey: boolean, key: string): boolean {
    return ctrlKey && key === "c";
}

export function exitOnCtrlC(ctrlKey: boolean, key: string): void {
    if (isCtrlC(ctrlKey, key)) {
        stdout.write("\n👋 Bye!\n");
        cleanup();
        process.exit(0);
    }
}

/** For tokenize-level demos that get raw ctrl-char tokens. */
export function exitOnCtrlCToken(kind: string, letter: string): void {
    if (kind === "ctrl-char" && letter === "c") {
        stdout.write("\n👋 Bye!\n");
        cleanup();
        process.exit(0);
    }
}

// ── Init ─────────────────────────────────────────────────────────

stdin.setRawMode(true);
stdin.setEncoding("utf8");
stdin.resume();

writePassthrough(KITTY_ENABLE);

process.on("exit", cleanup);
