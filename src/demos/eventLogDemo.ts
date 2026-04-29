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
import { exitOnCtrlC, stdin, stdout } from "./demoSetup.ts";

stdout.write("🎹 Event Log Demo (Kitty protocol enabled) — press any key. Ctrl+C to exit.\n\n");

const parser = new KeyInputParser();

stdin.on("data", (chunk: string) => {
    const events: KeyPressEvent[] = parser.parse(chunk);

    for (const event of events) {
        exitOnCtrlC(event.ctrlKey, event.key);

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
