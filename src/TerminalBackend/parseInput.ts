import { createKeyPressEvent, type KeyPressEvent } from "./KeyEvent.ts";

/**
 * Parse raw terminal input into KeyPressEvent[].
 *
 * Pure function, no side effects — easy to test and extend.
 *
 * Handles:
 * - Printable ASCII characters
 * - Ctrl+letter (0x01–0x1a except 0x09/0x0d/0x1b which are Tab/Enter/Escape)
 * - Enter (0x0d), Tab (0x09), Backspace (0x7f), Ctrl+Space (0x00)
 * - Escape (0x1b when standalone)
 * - CSI sequences: arrow keys, Home/End/Insert/Delete/PageUp/PageDown, F1–F12
 * - CSI sequences with xterm-style modifiers (e.g. \x1b[1;5A = Ctrl+ArrowUp)
 * - SS3 sequences: F1–F4 (\x1bOP–\x1bOS), cursor keys in application mode
 * - Kitty Keyboard Protocol: CSI u sequences (\x1b[<codepoint>;<modifiers>u)
 * - Alt+key via ESC prefix (\x1b followed by character)
 * - Alt+Ctrl+letter (\x1b followed by control character)
 */
export function parseInput(data: string): KeyPressEvent[] {
    const events: KeyPressEvent[] = [];
    let i = 0;

    while (i < data.length) {
        const code = data.charCodeAt(i);

        if (code === 0x1b) {
            // Escape: could be standalone, CSI, SS3, or Alt+key
            if (i + 1 >= data.length) {
                // Standalone Escape (last byte in buffer)
                events.push(createKeyPressEvent("Escape", data[i]));
                i++;
                continue;
            }

            const next = data.charCodeAt(i + 1);

            if (next === 0x5b) {
                // CSI sequence: \x1b[ ...
                const csiResult = parseCSI(data, i);
                if (csiResult) {
                    events.push(csiResult.event);
                    i = csiResult.nextIndex;
                    continue;
                }
                // Failed to parse CSI — emit Escape, let '[' be handled next iteration
                events.push(createKeyPressEvent("Escape", data[i]));
                i++;
            } else if (next === 0x4f) {
                // SS3 sequence: \x1bO<letter>
                if (i + 2 < data.length) {
                    const letter = data[i + 2];
                    const keyName = ss3KeyMap[letter];
                    if (keyName) {
                        events.push(createKeyPressEvent(keyName, data.slice(i, i + 3)));
                        i += 3;
                        continue;
                    }
                }
                // Unknown SS3 — emit Escape
                events.push(createKeyPressEvent("Escape", data[i]));
                i++;
            } else if (next === 0x0d) {
                // Alt+Enter
                events.push(createKeyPressEvent("Enter", data.slice(i, i + 2), { altKey: true }));
                i += 2;
            } else if (next === 0x7f) {
                // Alt+Backspace
                events.push(createKeyPressEvent("Backspace", data.slice(i, i + 2), { altKey: true }));
                i += 2;
            } else if (next >= 0x01 && next <= 0x1a) {
                // Alt+Ctrl+letter
                const letter = String.fromCharCode(next + 0x60);
                events.push(
                    createKeyPressEvent(letter, data.slice(i, i + 2), {
                        altKey: true,
                        ctrlKey: true,
                        code: `Key${letter.toUpperCase()}`,
                    }),
                );
                i += 2;
            } else if (next >= 0x20) {
                // Alt + printable character
                const char = data[i + 1];
                events.push(createKeyPressEvent(char, data.slice(i, i + 2), { altKey: true }));
                i += 2;
            } else {
                // Escape followed by unknown byte — emit Escape, continue
                events.push(createKeyPressEvent("Escape", data[i]));
                i++;
            }
        } else if (code === 0x00) {
            // Ctrl+Space (NUL)
            events.push(createKeyPressEvent(" ", data[i], { ctrlKey: true, code: "Space" }));
            i++;
        } else if (code === 0x0d) {
            events.push(createKeyPressEvent("Enter", data[i]));
            i++;
        } else if (code === 0x09) {
            events.push(createKeyPressEvent("Tab", data[i]));
            i++;
        } else if (code === 0x7f) {
            events.push(createKeyPressEvent("Backspace", data[i]));
            i++;
        } else if (code >= 0x01 && code <= 0x1a) {
            // Ctrl+A through Ctrl+Z (excluding Tab=0x09, Enter=0x0d, Escape=0x1b handled above)
            const letter = String.fromCharCode(code + 0x60); // 0x01 -> 'a', 0x03 -> 'c'
            events.push(
                createKeyPressEvent(letter, data[i], {
                    ctrlKey: true,
                    code: `Key${letter.toUpperCase()}`,
                }),
            );
            i++;
        } else if (code >= 0x20) {
            // Printable character (space and above)
            events.push(createKeyPressEvent(data[i], data[i]));
            i++;
        } else {
            // Unknown control character — pass through
            events.push(createKeyPressEvent(`<0x${code.toString(16).padStart(2, "0")}>`, data[i]));
            i++;
        }
    }

    return events;
}

// ─── CSI key maps ───

/** CSI final-byte → key name (cursor keys, F1–F4) */
const csiKeyMap: Record<string, string> = {
    A: "ArrowUp",
    B: "ArrowDown",
    C: "ArrowRight",
    D: "ArrowLeft",
    H: "Home",
    F: "End",
    P: "F1",
    Q: "F2",
    R: "F3",
    S: "F4",
};

/** CSI number~ → key name (navigation, F5–F12) */
const tildeKeyMap: Record<number, string> = {
    1: "Home",
    2: "Insert",
    3: "Delete",
    4: "End",
    5: "PageUp",
    6: "PageDown",
    7: "Home", // rxvt
    8: "End", // rxvt
    11: "F1",
    12: "F2",
    13: "F3",
    14: "F4",
    15: "F5",
    17: "F6",
    18: "F7",
    19: "F8",
    20: "F9",
    21: "F10",
    23: "F11",
    24: "F12",
};

/** SS3 (ESC O) final-byte → key name */
const ss3KeyMap: Record<string, string> = {
    A: "ArrowUp",
    B: "ArrowDown",
    C: "ArrowRight",
    D: "ArrowLeft",
    H: "Home",
    F: "End",
    P: "F1",
    Q: "F2",
    R: "F3",
    S: "F4",
};

// ─── Modifier decoding ───

/**
 * Decode xterm/kitty modifier parameter into individual boolean flags.
 *
 * Modifier encoding: value = 1 + bitmask
 * Bitmask bits: 0=Shift, 1=Alt, 2=Ctrl, 3=Meta/Super
 */
function decodeModifiers(mod: number): { shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean } {
    const bits = mod - 1;
    return {
        shiftKey: (bits & 1) !== 0,
        altKey: (bits & 2) !== 0,
        ctrlKey: (bits & 4) !== 0,
        metaKey: (bits & 8) !== 0,
    };
}

// ─── CSI parser ───

interface CSIParseResult {
    event: KeyPressEvent;
    nextIndex: number;
}

/**
 * Parse a CSI sequence starting at data[start] = ESC, data[start+1] = '['.
 * Returns the parsed event and next index, or null if the sequence is not recognized.
 */
function parseCSI(data: string, start: number): CSIParseResult | null {
    let i = start + 2; // skip ESC [

    // Collect parameter bytes (0x30–0x3f: digits, semicolons, <, =, >, ?)
    let params = "";
    while (i < data.length && data.charCodeAt(i) >= 0x30 && data.charCodeAt(i) <= 0x3f) {
        params += data[i];
        i++;
    }

    // Collect intermediate bytes (0x20–0x2f)
    while (i < data.length && data.charCodeAt(i) >= 0x20 && data.charCodeAt(i) <= 0x2f) {
        i++;
    }

    // Final byte (0x40–0x7e)
    if (i >= data.length) return null;
    const finalCode = data.charCodeAt(i);
    if (finalCode < 0x40 || finalCode > 0x7e) return null;
    const finalByte = data[i];

    const raw = data.slice(start, i + 1);
    const nextIndex = i + 1;

    // Parse semicolon-separated numeric parameters
    const paramList = params ? params.split(";").map((p) => (p === "" ? 0 : parseInt(p, 10))) : [];

    // ── Kitty Keyboard Protocol: CSI <codepoint> ; <modifiers> u ──
    if (finalByte === "u") {
        const codepoint = paramList[0] ?? 0;
        const mod = paramList[1] ?? 1;
        const mods = decodeModifiers(mod);
        const key = String.fromCodePoint(codepoint);
        return { event: createKeyPressEvent(key, raw, mods), nextIndex };
    }

    // ── Tilde sequences: CSI <number> ; <modifier>? ~ ──
    if (finalByte === "~") {
        const num = paramList[0] ?? 0;
        const mod = paramList[1] ?? 1;
        const keyName = tildeKeyMap[num];
        if (!keyName) return null;
        const mods = decodeModifiers(mod);
        return { event: createKeyPressEvent(keyName, raw, mods), nextIndex };
    }

    // ── Cursor / navigation / F1–F4: CSI <1;mod>? <letter> ──
    const keyName = csiKeyMap[finalByte];
    if (keyName) {
        const mod = paramList.length >= 2 ? (paramList[1] ?? 1) : 1;
        const mods = decodeModifiers(mod);
        return { event: createKeyPressEvent(keyName, raw, mods), nextIndex };
    }

    // Unknown CSI sequence
    return null;
}
