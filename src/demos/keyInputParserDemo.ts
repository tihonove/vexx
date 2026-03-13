/**
 * KeyInputParser Demo — shows browser-like keyboard events from the terminal.
 *
 * Usage: npx tsx src/demos/keyInputParserDemo.ts
 * Press keys to see their parsed representation. Ctrl+C to exit.
 *
 * Enables Kitty Keyboard Protocol for full modifier support and keyup events.
 * Without Kitty, only keydown+keypress are emitted (no keyup from legacy terminals).
 *
 * Event model (browser-like):
 *   Normal keys: keydown → keypress (+ keyup with Kitty)
 *   Modifiers:   keydown → keyup (no keypress, same as browser)
 *   Hold/repeat: keydown → keypress → keypress → ... → keyup
 */

import { KeyInputParser } from "../TerminalBackend/KeyInputParser.ts";
import type { KeyPressEvent } from "../TerminalBackend/KeyEvent.ts";

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

// ── ANSI colors ──
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const gray = (s: string) => `\x1b[90m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

function colorType(type: string): string {
    switch (type) {
        case "keydown": return cyan(type);
        case "keypress": return green(type);
        case "keyup": return gray(type);
        default: return type;
    }
}

function formatModifiers(event: KeyPressEvent): string {
    const mods: string[] = [];
    if (event.ctrlKey) mods.push("Ctrl");
    if (event.shiftKey) mods.push("Shift");
    if (event.altKey) mods.push("Alt");
    if (event.metaKey) mods.push("Meta");
    return mods.length > 0 ? mods.join("+") + "+" : "";
}

function formatRaw(raw: string): string {
    return Array.from(raw)
        .map((ch: string) => "0x" + ch.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(" ");
}

stdout.write(bold("🎹 KeyInputParser Demo") + " (browser-like event model, Kitty enabled)\n");
stdout.write("Press keys to see events. Ctrl+C to exit.\n\n");
stdout.write(gray("  type      key          code         modifiers    raw\n"));
stdout.write(gray("  ────────  ───────────  ───────────  ───────────  ──────────\n"));

const parser = new KeyInputParser();

stdin.on("data", (chunk: string) => {
    const events: KeyPressEvent[] = parser.parse(chunk);

    for (const event of events) {
        if (event.type === "keypress" && event.ctrlKey && event.key === "c") {
            stdout.write("\n👋 Bye!\n");
            cleanup();
            process.exit(0);
        }

        const type = colorType(event.type.padEnd(8));
        const key = event.key.padEnd(12);
        const code = event.code.padEnd(12);
        const mods = formatModifiers(event).padEnd(12) || gray("none").padEnd(12 + 9); // +9 for ANSI escape
        const raw = gray(formatRaw(event.raw));

        stdout.write(`  ${type}  ${key} ${code} ${mods} ${raw}\n`);
    }
});
