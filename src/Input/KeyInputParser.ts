import { convertTokenToKeyPressEvent } from "./convertToken.ts";
import { createKeyPressEvent, type KeyPressEvent } from "./KeyEvent.ts";
import { parseInput } from "./parseInput.ts";
import type { MouseToken } from "./RawTerminalToken.ts";
import { tokenize } from "./tokenize.ts";

/**
 * Set of key values representing modifier keys.
 * These follow the browser model: keydown/keyup only, no keypress synthesized.
 */
const modifierKeyValues = new Set([
    "Shift",
    "Control",
    "Alt",
    "Meta",
    "Hyper",
    "Super",
    "AltGraph",
    "ISO_Level5_Shift",
    "CapsLock",
    "NumLock",
    "ScrollLock",
]);

/**
 * Stateful keyboard input parser — browser-like KeyboardEvent model.
 *
 * Normalizes both legacy terminal input and Kitty protocol into a uniform
 * event sequence matching the DOM KeyboardEvent spec:
 *
 * Normal keys:
 *   keydown → keypress  (legacy: no keyup since protocol doesn't send it)
 *   keydown → keypress → keyup  (Kitty: full lifecycle)
 *   keydown → keypress → keypress(repeat) → ... → keyup  (Kitty hold)
 *
 * Modifier-only keys (Shift, Ctrl, Alt, Meta):
 *   keydown → keyup  (no keypress — same as browser)
 *
 * Orphaned keyup (macOS Cmd+Arrow — release without prior press):
 *   synthesizes keydown + keypress before the keyup
 *
 * Usage:
 *   const parser = new KeyInputParser();
 *   stdin.on("data", (chunk) => {
 *       const events = parser.parse(chunk);
 *   });
 */
export class KeyInputParser {
    private readonly pressedKeys = new Set<string>();

    /**
     * Parse a chunk of raw terminal input into browser-like keyboard events.
     */
    public parse(data: string): KeyPressEvent[] {
        const rawEvents = parseInput(data);
        return this.processKeyEvents(rawEvents);
    }

    /**
     * Parse raw terminal input, returning both keyboard events and mouse tokens.
     */
    public parseWithMouse(data: string): { keys: KeyPressEvent[]; mouse: MouseToken[] } {
        const tokens = tokenize(data);
        const mouseTokens: MouseToken[] = [];
        const keyEvents: KeyPressEvent[] = [];

        for (const token of tokens) {
            if (token.kind === "mouse") {
                mouseTokens.push(token);
            } else {
                keyEvents.push(convertTokenToKeyPressEvent(token));
            }
        }

        return { keys: this.processKeyEvents(keyEvents), mouse: mouseTokens };
    }

    private processKeyEvents(rawEvents: KeyPressEvent[]): KeyPressEvent[] {
        const result: KeyPressEvent[] = [];

        for (const event of rawEvents) {
            if (event.type === "keydown") {
                this.pressedKeys.add(event.key);
                result.push(event);
                if (!modifierKeyValues.has(event.key)) {
                    result.push(
                        createKeyPressEvent(event.key, event.raw, {
                            type: "keypress",
                            code: event.code,
                            ctrlKey: event.ctrlKey,
                            shiftKey: event.shiftKey,
                            altKey: event.altKey,
                            metaKey: event.metaKey,
                        }),
                    );
                }
            } else if (event.type === "keypress") {
                this.pressedKeys.add(event.key);
                result.push(event);
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            } else if (event.type === "keyup") {
                if (!modifierKeyValues.has(event.key) && !this.pressedKeys.has(event.key)) {
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
