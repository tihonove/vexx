/**
 * Mouse Demo — prints every parsed mouse & keyboard token as JSON to stdout.
 *
 * Usage: npx tsx src/demos/mouseDemo.ts
 * Click, scroll, drag in the terminal to see mouse events. Press keys to see keyboard tokens.
 * Ctrl+C to exit.
 *
 * Enables:
 * - Kitty Keyboard Protocol (flags 11 = disambiguate + event types + all-keys-as-escapes)
 * - SGR mouse tracking (any-event mode — reports press, release, scroll, motion)
 *
 * See: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking
 */

import { MOUSE_TRACKING_ALL_ENABLE, MOUSE_TRACKING_DISABLE } from "../Input/mouseTracking.ts";
import { tokenize } from "../Input/tokenize.ts";

const stdin = process.stdin;
const stdout = process.stdout;

// ── Kitty Keyboard Protocol + TMUX passthrough ──
const KITTY_ENABLE = "\x1b[>11u";
const KITTY_DISABLE = "\x1b[<u";

const isTmux = process.env.TMUX != null && process.env.TMUX !== "";

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
writePassthrough(MOUSE_TRACKING_ALL_ENABLE);

function cleanup(): void {
    writePassthrough(MOUSE_TRACKING_DISABLE);
    writePassthrough(KITTY_DISABLE);
    stdin.setRawMode(false);
}

process.on("exit", cleanup);

stdout.write("🖱️  Mouse Demo (SGR mouse + Kitty keyboard) — click, scroll, move. Ctrl+C to exit.\n\n");

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

        if (token.kind === "mouse") {
            const json = {
                kind: token.kind,
                button: token.button,
                action: token.action,
                x: token.x,
                y: token.y,
                shiftKey: token.shiftKey,
                altKey: token.altKey,
                ctrlKey: token.ctrlKey,
                raw: rawHex,
            };
            stdout.write("🖱️  " + JSON.stringify(json) + "\n");
        } else {
            stdout.write("⌨️  " + JSON.stringify({ kind: token.kind, raw: rawHex }) + "\n");
        }
    }
});
