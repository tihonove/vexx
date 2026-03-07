/**
 * Event Log Demo — prints every parsed keyboard event as JSON to stdout.
 *
 * Usage: node src/demos/eventLogDemo.ts
 * Press keys to see their parsed representation. Ctrl+C to exit.
 *
 * Great for testing what the parser produces for various key combinations,
 * arrow keys, F-keys, modifiers, and Kitty protocol sequences.
 */

import { parseInput } from "../TerminalBackend/parseInput.ts";
import type { KeyPressEvent } from "../TerminalBackend/KeyEvent.ts";

const stdin = process.stdin;
const stdout = process.stdout;

stdin.setRawMode(true);
stdin.setEncoding("utf8");
stdin.resume();

stdout.write("🎹 Event Log Demo — press any key to see its parsed event. Ctrl+C to exit.\n\n");

stdin.on("data", (chunk: string) => {
    const events: KeyPressEvent[] = parseInput(chunk);

    for (const event of events) {
        // Exit on Ctrl+C
        if (event.ctrlKey && event.key === "c") {
            stdout.write("\n👋 Bye!\n");
            stdin.setRawMode(false);
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
