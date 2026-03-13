/**
 * Tokenize Demo — prints every raw terminal token as JSON to stdout.
 *
 * Usage: npx tsx src/demos/tokenizeDemo.ts
 * Press keys to see their tokenized representation. Ctrl+C to exit.
 *
 * Enables Kitty Keyboard Protocol for full modifier support.
 *
 * Kitty protocol flags used (push mode):
 *   1 = Disambiguate escape codes
 *   2 = Report event types (press/repeat/release)
 *   8 = Report all keys as escape codes
 * Total: 11 = 1 | 2 | 8
 */

import { tokenize } from "../RawTokenParsing/tokenize.ts";

const stdin = process.stdin;
const stdout = process.stdout;

// ── Kitty Keyboard Protocol + TMUX passthrough ──
const KITTY_ENABLE = "\x1b[>11u";
const KITTY_DISABLE = "\x1b[<u";

const isTmux = process.env["TMUX"] != null && process.env["TMUX"] !== "";

function wrapForTmux(sequence: string): string {
    const escaped = sequence.replace(/\x1b/g, "\x1b\x1b");
    return `\x1bPtmux;${escaped}\x1b\\`;
}

function writePassthrough(sequence: string): void {
    stdout.write(isTmux ? wrapForTmux(sequence) : sequence);
}

stdin.setRawMode(true);
stdin.setEncoding("utf8");
stdin.resume();

writePassthrough(KITTY_ENABLE);

function cleanup(): void {
    writePassthrough(KITTY_DISABLE);
    stdin.setRawMode(false);
}

process.on("exit", cleanup);

stdout.write("🔬 Tokenize Demo (Kitty protocol enabled) — press any key. Ctrl+C to exit.\n\n");

stdin.on("data", (chunk: string) => {
    const tokens = tokenize(chunk);

    for (const token of tokens) {
        // Exit on Ctrl+C
        if (token.kind === "ctrl-char" && token.letter === "c") {
            stdout.write("\n👋 Bye!\n");
            cleanup();
            process.exit(0);
        }

        // Format raw bytes as hex for readability
        const rawHex = Array.from(token.raw)
            .map((ch: string) => "0x" + ch.charCodeAt(0).toString(16).padStart(2, "0"))
            .join(" ");

        const { raw: _raw, ...rest } = token;
        const output = { ...rest, raw: rawHex };

        stdout.write(JSON.stringify(output) + "\n");
    }
});
