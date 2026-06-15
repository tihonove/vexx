import { convertTokenToKeyPressEvent } from "./convertToken.ts";
import { createKeyPressEvent, type KeyPressEvent } from "./KeyEvent.ts";
import type { DeviceReportToken, MouseToken, OscToken } from "./RawTerminalToken.ts";
import { parseCSI, parseOSC, tokenize } from "./tokenize.ts";

/**
 * Index where an *incomplete* trailing escape sequence begins, or -1 if `data`
 * ends on a clean token boundary.
 *
 * Over SSH/tmux (and any slow link) a single keypress can be split across two
 * stdin reads — e.g. Ctrl+Shift+P (`\x1b[112;6u`) arriving as `\x1b[112;6` then
 * `u`. Without this, the first chunk is mis-tokenized into a lone Escape plus
 * literal characters and the keybinding silently fails; the user has to press
 * again. We detect the dangling tail so KeyInputParser can hold it and prepend
 * it to the next chunk.
 *
 * Only a sequence that starts at the *last* ESC and runs to the end can be
 * incomplete — anything before it is already followed by more bytes.
 */
function incompleteTailStart(data: string): number {
    const esc = data.lastIndexOf("\x1b");
    if (esc === -1) return -1;

    const next = data.charCodeAt(esc + 1);
    // Lone trailing ESC: ambiguous (Escape key vs. start of a split sequence) — buffer it.
    if (Number.isNaN(next)) return esc;

    // CSI / OSC reuse the real parsers, so completeness exactly matches tokenize().
    if (next === 0x5b) return parseCSI(data, esc) === null ? esc : -1; // ESC [
    if (next === 0x5d) return parseOSC(data, esc) === null ? esc : -1; // ESC ]
    if (next === 0x4f) return esc + 2 >= data.length ? esc : -1; // ESC O (SS3) needs its final letter

    // ESC + printable / control / special is complete once the second byte is present (it is).
    return -1;
}

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
interface InputStreams {
    keys: KeyPressEvent[];
    mouse: MouseToken[];
    osc: OscToken[];
    deviceReports: DeviceReportToken[];
}

export class KeyInputParser {
    private readonly pressedKeys = new Set<string>();

    /** Tail of the previous chunk that was cut mid-escape-sequence; "" when none. */
    private pending = "";

    /**
     * Parse a chunk of raw terminal input into browser-like keyboard events.
     */
    public parse(data: string): KeyPressEvent[] {
        return this.ingest(data).keys;
    }

    /**
     * Parse raw terminal input, returning both keyboard events and mouse tokens.
     */
    public parseWithMouse(data: string): InputStreams {
        return this.ingest(data);
    }

    /** True when a partial escape sequence is buffered, awaiting the rest of its bytes. */
    public hasPending(): boolean {
        return this.pending !== "";
    }

    /**
     * Force-process any buffered partial sequence as-is (a lone ESC becomes the
     * Escape key). Callers use a short timeout so a real Escape keypress isn't
     * held hostage waiting for a continuation that never comes.
     */
    public flush(): InputStreams {
        const tail = this.pending;
        this.pending = "";
        return tail === "" ? { keys: [], mouse: [], osc: [], deviceReports: [] } : this.tokenizeToStreams(tail);
    }

    /**
     * Prepend any buffered tail, then split off a fresh incomplete tail before
     * tokenizing so a sequence cut across stdin reads is reassembled.
     */
    private ingest(data: string): InputStreams {
        const combined = this.pending + data;
        const cut = incompleteTailStart(combined);
        if (cut === -1) {
            this.pending = "";
            return this.tokenizeToStreams(combined);
        }
        this.pending = combined.slice(cut);
        return this.tokenizeToStreams(combined.slice(0, cut));
    }

    private tokenizeToStreams(data: string): InputStreams {
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
