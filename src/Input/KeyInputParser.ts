import { convertTokenToKeyPressEvent } from "./convertToken.ts";
import { createKeyPressEvent, type KeyPressEvent } from "./KeyEvent.ts";
import { parseInput } from "./parseInput.ts";
import type { DeviceReportToken, MouseToken, OscToken } from "./RawTerminalToken.ts";
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
 *   keydown → keypress → keydown → keypress → ... → keyup  (Kitty hold/auto-repeat)
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
    public parseWithMouse(data: string): {
        keys: KeyPressEvent[];
        mouse: MouseToken[];
        osc: OscToken[];
        deviceReports: DeviceReportToken[];
    } {
        const tokens = tokenize(data);
        const mouseTokens: MouseToken[] = [];
        const keyEvents: KeyPressEvent[] = [];
        const oscTokens: OscToken[] = [];
        const deviceReports: DeviceReportToken[] = [];

        for (const token of tokens) {
            if (token.kind === "mouse") {
                mouseTokens.push(token);
            } else if (token.kind === "osc") {
                oscTokens.push(token);
            } else if (token.kind === "device-report") {
                deviceReports.push(token);
            } else {
                keyEvents.push(convertTokenToKeyPressEvent(token));
            }
        }

        return { keys: this.processKeyEvents(keyEvents), mouse: mouseTokens, osc: oscTokens, deviceReports };
    }

    private processKeyEvents(rawEvents: KeyPressEvent[]): KeyPressEvent[] {
        const result: KeyPressEvent[] = [];

        for (const event of rawEvents) {
            if (event.type === "keydown") {
                this.pressedKeys.add(event.code);
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
                /* v8 ignore start -- unreachable: no token converter emits a synthetic "keypress" (processKeyEvents only ever sees keydown/keyup), so the keypress branch never runs and the keyup else-if's false path (the closed-union fall-through) is also dead */
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            } else if (event.type === "keypress") {
                this.pressedKeys.add(event.code);
                result.push(event);
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            } else if (event.type === "keyup") {
                /* v8 ignore stop */
                if (!modifierKeyValues.has(event.key) && !this.pressedKeys.has(event.code)) {
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
                this.pressedKeys.delete(event.code);
                result.push(event);
            } else {
                /* v8 ignore start -- unreachable: event.type is a closed union (keydown|keypress|keyup), all handled above */
                result.push(event);
                /* v8 ignore stop */
            }
        }

        return result;
    }
}
