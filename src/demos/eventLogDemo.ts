/**
 * Event Log Demo — prints every parsed keyboard event as JSON to stdout.
 *
 * Usage: node src/demos/eventLogDemo.ts
 * Press keys to see their parsed representation. Ctrl+C to exit.
 *
 * Enables Kitty Keyboard Protocol for full modifier support (Shift, Alt, Meta,
 * not just Ctrl). Without Kitty, the terminal only sends legacy control codes
 * where most modifier info is lost.
 *
 * Kitty protocol flags used (push mode):
 *   1 = Disambiguate escape codes
 *   2 = Report event types (press/repeat/release)
 *   8 = Report all keys as escape codes
 * Total: 11 = 1 | 2 | 8
 *
 * See: https://sw.kovidgoyal.net/kitty/keyboard-protocol/
 */

import type { KeyPressEvent } from "../Input/KeyEvent.ts";
import { KeyInputParser } from "../Input/KeyInputParser.ts";

const stdin = process.stdin;
const stdout = process.stdout;

// ── Kitty Keyboard Protocol + TMUX passthrough ──
const KITTY_ENABLE = "\x1b[>11u";
const KITTY_DISABLE = "\x1b[<u";

const isTmux = process.env.TMUX != null && process.env.TMUX !== "";

function wrapForTmux(sequence: string): string {
    // eslint-disable-next-line no-control-regex
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

stdout.write("🎹 Event Log Demo (Kitty protocol enabled) — press any key. Ctrl+C to exit.\n\n");

const parser = new KeyInputParser();

stdin.on("data", (chunk: string) => {
    const events: KeyPressEvent[] = parser.parse(chunk);

    for (const event of events) {
        // Exit on Ctrl+C
        if (event.ctrlKey && event.key === "c") {
            stdout.write("\n👋 Bye!\n");
            cleanup();
            process.exit(0);
        }

        // Format raw bytes as hex for readability
        const rawHex = Array.from(event.raw)
            .map((ch: string) => "0x" + ch.charCodeAt(0).toString(16).padStart(2, "0"))
            .join(" ");

        const json = {
            type: event.type,
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            raw: rawHex,
        };

        stdout.write(JSON.stringify(json) + "\n");
    }
});
