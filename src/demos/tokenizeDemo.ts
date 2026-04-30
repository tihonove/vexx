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

import { tokenize } from "../Input/tokenize.ts";

import { exitOnCtrlCToken, stdin, stdout } from "./demoSetup.ts";

stdout.write("🔬 Tokenize Demo (Kitty protocol enabled) — press any key. Ctrl+C to exit.\n\n");

stdin.on("data", (chunk: string) => {
    const tokens = tokenize(chunk);

    for (const token of tokens) {
        exitOnCtrlCToken(token);

        // Format raw bytes as hex for readability
        const rawHex = Array.from(token.raw)
            .map((ch: string) => "0x" + ch.charCodeAt(0).toString(16).padStart(2, "0"))
            .join(" ");

        const { raw: _raw, ...rest } = token;
        const output = { ...rest, raw: rawHex };

        stdout.write(JSON.stringify(output) + "\n");
    }
});
