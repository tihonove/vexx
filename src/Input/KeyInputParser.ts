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
 * Bracketed paste markers (DEC mode ?2004). The terminal wraps clipboard pastes
 * as `ESC[200~ <literal text> ESC[201~`, letting us insert the whole block as one
 * text edit instead of replaying it byte-by-byte through key parsing (which would
 * turn newlines into Enter keypresses and run special characters as shortcuts).
 */
const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";

/**
 * If `s` ends with a non-empty proper prefix of `marker` (a marker split across
 * stdin reads), return the index where that partial tail begins; otherwise `s.length`.
 * Used while accumulating paste content so a split `ESC[201~` end marker is held back
 * rather than swallowed into the pasted text.
 */
function partialMarkerTailStart(s: string, marker: string): number {
    const max = Math.min(s.length, marker.length - 1);
    for (let len = max; len > 0; len--) {
        if (s.endsWith(marker.slice(0, len))) return s.length - len;
    }
    return s.length;
}

/** Normalize pasted line endings: CRLF and lone CR both become LF. */
function normalizeNewlines(text: string): string {
    return text.replace(/\r\n?/g, "\n");
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
    /** Text blocks delivered via bracketed paste (already newline-normalized). */
    paste: string[];
}

function emptyStreams(): InputStreams {
    return { keys: [], mouse: [], osc: [], deviceReports: [], paste: [] };
}

export class KeyInputParser {
    private readonly pressedKeys = new Set<string>();

    /** Tail of the previous chunk that was cut mid-escape-sequence; "" when none. */
    private pending = "";

    /** True while accumulating bracketed-paste content (between ESC[200~ and ESC[201~). */
    private pasting = false;

    /** Pasted text accumulated so far, awaiting the ESC[201~ end marker. */
    private pasteBuffer = "";

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
     *
     * While a paste is in flight (ESC[200~ seen, ESC[201~ not yet), this is a no-op:
     * the held tail is a split end marker, not a stuck escape — keep accumulating so
     * the paste isn't corrupted or truncated.
     */
    public flush(): InputStreams {
        const streams = emptyStreams();
        if (this.pasting) return streams;
        const tail = this.pending;
        this.pending = "";
        if (tail !== "") this.tokenizeInto(tail, streams);
        return streams;
    }

    /**
     * Reassemble the stream across reads, splitting out bracketed-paste blocks so
     * their literal text bypasses key tokenization entirely. Normal segments keep the
     * existing behavior: prepend any buffered tail, then hold back a fresh incomplete
     * tail so an escape sequence cut across stdin reads is reassembled next chunk.
     */
    private ingest(data: string): InputStreams {
        let combined = this.pending + data;
        this.pending = "";
        const streams = emptyStreams();

        while (combined !== "") {
            if (this.pasting) {
                const endIdx = combined.indexOf(PASTE_END);
                if (endIdx === -1) {
                    // No end marker yet: accumulate, but hold back a possible split ESC[201~.
                    const tailStart = partialMarkerTailStart(combined, PASTE_END);
                    this.pasteBuffer += combined.slice(0, tailStart);
                    this.pending = combined.slice(tailStart);
                    return streams;
                }
                this.pasteBuffer += combined.slice(0, endIdx);
                const text = normalizeNewlines(this.pasteBuffer);
                if (text !== "") streams.paste.push(text);
                this.pasteBuffer = "";
                this.pasting = false;
                combined = combined.slice(endIdx + PASTE_END.length);
                continue;
            }

            const startIdx = combined.indexOf(PASTE_START);
            if (startIdx === -1) {
                // No paste start in view. A trailing partial ESC[200~ is an incomplete CSI,
                // so incompleteTailStart already holds it back like any split sequence.
                const cut = incompleteTailStart(combined);
                if (cut === -1) {
                    this.tokenizeInto(combined, streams);
                } else {
                    this.tokenizeInto(combined.slice(0, cut), streams);
                    this.pending = combined.slice(cut);
                }
                return streams;
            }

            // Bytes before the marker are complete (a full marker follows them).
            this.tokenizeInto(combined.slice(0, startIdx), streams);
            this.pasting = true;
            combined = combined.slice(startIdx + PASTE_START.length);
        }

        return streams;
    }

    private tokenizeInto(data: string, streams: InputStreams): void {
        if (data === "") return;
        const tokens = tokenize(data);
        const keyEvents: KeyPressEvent[] = [];

        for (const token of tokens) {
            if (token.kind === "mouse") {
                streams.mouse.push(token);
            } else if (token.kind === "osc") {
                streams.osc.push(token);
            } else if (token.kind === "device-report") {
                streams.deviceReports.push(token);
            } else if (token.kind === "unknown-csi") {
                // Complete but unrecognized CSI sequence — drop it (never type it as text).
            } else {
                keyEvents.push(convertTokenToKeyPressEvent(token));
            }
        }

        for (const event of this.processKeyEvents(keyEvents)) {
            streams.keys.push(event);
        }
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
