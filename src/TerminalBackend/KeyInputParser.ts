import { createKeyPressEvent, type KeyPressEvent } from "./KeyEvent.ts";
import { parseInput } from "./parseInput.ts";

/**
 * Set of key values representing modifier keys.
 * keyup for these does NOT get a synthesized keypress.
 */
const modifierKeyValues = new Set([
    "Shift", "Control", "Alt", "Meta", "Hyper", "Super",
    "AltGraph", "ISO_Level5_Shift", "CapsLock", "NumLock", "ScrollLock",
]);

/**
 * Stateful keyboard input parser that wraps the pure `parseInput` function.
 *
 * Produces DOM-style event sequences: keydown → keypress → keyup.
 *
 * - For every keydown of a non-modifier key, synthesizes a keypress after it.
 * - Tracks pressed keys across stdin chunks.
 * - On macOS with Kitty protocol, some combos (e.g. Cmd+Arrow) only send a
 *   release event without a press. Detects orphaned keyup and synthesizes
 *   keydown + keypress before them.
 *
 * Usage:
 *   const parser = new KeyInputParser();
 *   stdin.on("data", (chunk) => {
 *       const events = parser.parse(chunk);
 *       // events: keydown → keypress → ... → keyup
 *   });
 */
export class KeyInputParser {
    private readonly pressedKeys = new Set<string>();

    /**
     * Parse a chunk of raw terminal input, returning DOM-style event sequence.
     */
    parse(data: string): KeyPressEvent[] {
        const rawEvents = parseInput(data);
        const result: KeyPressEvent[] = [];

        for (const event of rawEvents) {
            if (event.type === "keydown") {
                this.pressedKeys.add(event.key);
                result.push(event);
                // Synthesize keypress after keydown for non-modifier keys
                if (!modifierKeyValues.has(event.key)) {
                    result.push(createKeyPressEvent(event.key, event.raw, {
                        type: "keypress",
                        code: event.code,
                        ctrlKey: event.ctrlKey,
                        shiftKey: event.shiftKey,
                        altKey: event.altKey,
                        metaKey: event.metaKey,
                    }));
                }
            } else if (event.type === "keypress") {
                // Repeat event from Kitty — pass through as-is (already keypress)
                this.pressedKeys.add(event.key);
                result.push(event);
            } else if (event.type === "keyup") {
                if (!modifierKeyValues.has(event.key) && !this.pressedKeys.has(event.key)) {
                    // Orphaned keyup — synthesize keydown + keypress before it
                    const synth = {
                        type: "keypress" as const,
                        code: event.code,
                        ctrlKey: event.ctrlKey,
                        shiftKey: event.shiftKey,
                        altKey: event.altKey,
                        metaKey: event.metaKey,
                    };
                    result.push(createKeyPressEvent(event.key, event.raw, { ...synth, type: "keydown" }));
                    result.push(createKeyPressEvent(event.key, event.raw, synth));
                }
                this.pressedKeys.delete(event.key);
                result.push(event);
            } else {
                result.push(event);
            }
        }

        return result;
    }
}
