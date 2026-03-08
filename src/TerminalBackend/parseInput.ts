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
 *   - Event types (press/repeat/release via modifier:eventtype)
 *   - Functional key codepoints (modifier keys, F13+, media keys, etc.)
 * - Alt+key via ESC prefix (\x1b followed by character)
 * - Alt+Ctrl+letter (\x1b followed by control character)
 * - Kitty PUA characters (U+E000–U+E0FF) for functional keys
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
                // Alt + printable character, or Kitty PUA functional key
                const kittyKey = kittyCodepointMap[next];
                if (kittyKey) {
                    // PUA characters (U+E000+) are never typed directly.
                    // ESC prefix here is a disambiguator, NOT an Alt modifier.
                    // Per Kitty protocol flag 1, Alt+functional would use CSI u encoding.
                    // This is a key press → keydown.
                    events.push(
                        createKeyPressEvent(kittyKey.key, data.slice(i, i + 2), {
                            type: "keydown",
                            code: kittyKey.code ?? kittyKey.key,
                        }),
                    );
                } else {
                    const char = data[i + 1];
                    events.push(createKeyPressEvent(char, data.slice(i, i + 2), { altKey: true }));
                }
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
            // Printable character (space and above), or Kitty PUA functional key
            const kittyKey = kittyCodepointMap[code];
            if (kittyKey) {
                events.push(
                    createKeyPressEvent(kittyKey.key, data[i], {
                        type: "keydown",
                        code: kittyKey.code ?? kittyKey.key,
                    }),
                );
            } else {
                events.push(createKeyPressEvent(data[i], data[i]));
            }
            i++;
        } else {
            // Unknown control character — pass through
            events.push(createKeyPressEvent(`<0x${code.toString(16).padStart(2, "0")}>`, data[i]));
            i++;
        }
    }

    return events;
}

// ─── Kitty functional key codepoints ───

/**
 * Map Kitty Keyboard Protocol codepoints (Private Use Area U+E000+) to DOM-style key/code.
 * Also includes standard codepoints used in CSI u for common keys (Enter, Tab, etc.).
 *
 * Reference: https://sw.kovidgoyal.net/kitty/keyboard-protocol/#functional-key-definitions
 */
const kittyCodepointMap: Record<number, { key: string; code?: string }> = {
    // Standard keys with CSI u encoding
    9: { key: "Tab" },
    13: { key: "Enter" },
    27: { key: "Escape" },
    127: { key: "Backspace" },

    // Lock keys
    57358: { key: "CapsLock" },
    57359: { key: "ScrollLock" },
    57360: { key: "NumLock" },

    // Misc functional
    57361: { key: "PrintScreen" },
    57362: { key: "Pause" },
    57363: { key: "ContextMenu" },

    // F13–F24
    57376: { key: "F13" },
    57377: { key: "F14" },
    57378: { key: "F15" },
    57379: { key: "F16" },
    57380: { key: "F17" },
    57381: { key: "F18" },
    57382: { key: "F19" },
    57383: { key: "F20" },
    57384: { key: "F21" },
    57385: { key: "F22" },
    57386: { key: "F23" },
    57387: { key: "F24" },

    // F25–F35
    57388: { key: "F25" },
    57389: { key: "F26" },
    57390: { key: "F27" },
    57391: { key: "F28" },
    57392: { key: "F29" },
    57393: { key: "F30" },
    57394: { key: "F31" },
    57395: { key: "F32" },
    57396: { key: "F33" },
    57397: { key: "F34" },
    57398: { key: "F35" },

    // Keypad
    57399: { key: "0", code: "Numpad0" },
    57400: { key: "1", code: "Numpad1" },
    57401: { key: "2", code: "Numpad2" },
    57402: { key: "3", code: "Numpad3" },
    57403: { key: "4", code: "Numpad4" },
    57404: { key: "5", code: "Numpad5" },
    57405: { key: "6", code: "Numpad6" },
    57406: { key: "7", code: "Numpad7" },
    57407: { key: "8", code: "Numpad8" },
    57408: { key: "9", code: "Numpad9" },
    57409: { key: ".", code: "NumpadDecimal" },
    57410: { key: "/", code: "NumpadDivide" },
    57411: { key: "*", code: "NumpadMultiply" },
    57412: { key: "-", code: "NumpadSubtract" },
    57413: { key: "+", code: "NumpadAdd" },
    57414: { key: "Enter", code: "NumpadEnter" },
    57415: { key: "=", code: "NumpadEqual" },
    57416: { key: ",", code: "NumpadComma" },
    57417: { key: "ArrowLeft", code: "Numpad4" },
    57418: { key: "ArrowRight", code: "Numpad6" },
    57419: { key: "ArrowUp", code: "Numpad8" },
    57420: { key: "ArrowDown", code: "Numpad2" },
    57421: { key: "PageUp", code: "Numpad9" },
    57422: { key: "PageDown", code: "Numpad3" },
    57423: { key: "Home", code: "Numpad7" },
    57424: { key: "End", code: "Numpad1" },
    57425: { key: "Insert", code: "Numpad0" },
    57426: { key: "Delete", code: "NumpadDecimal" },
    57427: { key: "Clear", code: "NumpadClear" },

    // Media keys
    57428: { key: "MediaPlay" },
    57429: { key: "MediaPause" },
    57430: { key: "MediaPlayPause" },
    57431: { key: "MediaReverse" },
    57432: { key: "MediaStop" },
    57433: { key: "MediaFastForward" },
    57434: { key: "MediaRewind" },
    57435: { key: "MediaTrackNext" },
    57436: { key: "MediaTrackPrevious" },
    57437: { key: "MediaRecord" },
    57438: { key: "AudioVolumeDown" },
    57439: { key: "AudioVolumeUp" },
    57440: { key: "AudioVolumeMute" },

    // Modifier keys
    57441: { key: "Shift", code: "ShiftLeft" },
    57442: { key: "Control", code: "ControlLeft" },
    57443: { key: "Alt", code: "AltLeft" },
    57444: { key: "Meta", code: "MetaLeft" },
    57445: { key: "Hyper", code: "HyperLeft" },
    57446: { key: "Super", code: "SuperLeft" },
    57447: { key: "Shift", code: "ShiftRight" },
    57448: { key: "Control", code: "ControlRight" },
    57449: { key: "Alt", code: "AltRight" },
    57450: { key: "Meta", code: "MetaRight" },
    57451: { key: "Hyper", code: "HyperRight" },
    57452: { key: "Super", code: "SuperRight" },
    57453: { key: "AltGraph" },
    57454: { key: "ISO_Level5_Shift" },
};

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
 * Bitmask bits: 0=Shift, 1=Alt, 2=Ctrl, 3=Super(Meta), 4=Hyper, 5=Meta, 6=CapsLock, 7=NumLock
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

/**
 * Parse a Kitty modifier parameter string that may contain `:eventtype` suffix.
 *
 * Format: "modifier" or "modifier:eventtype"
 * Event types: 1=press, 2=repeat, 3=release
 *
 * Returns modifier value (default 1 = no modifiers) and event type (0 = not specified).
 */
function parseModifierParam(paramStr: string): { mod: number; eventType: number } {
    const colonIdx = paramStr.indexOf(":");
    if (colonIdx >= 0) {
        return {
            mod: parseInt(paramStr.substring(0, colonIdx), 10) || 1,
            eventType: parseInt(paramStr.substring(colonIdx + 1), 10) || 1,
        };
    }
    return { mod: paramStr === "" ? 1 : parseInt(paramStr, 10) || 1, eventType: 0 };
}

/**
 * Parse a Kitty codepoint parameter string that may contain `:shifted:base` sub-fields.
 * We only use the first sub-field (the main codepoint).
 */
function parseCodepointParam(paramStr: string): number {
    const colonIdx = paramStr.indexOf(":");
    const str = colonIdx >= 0 ? paramStr.substring(0, colonIdx) : paramStr;
    return str === "" ? 0 : parseInt(str, 10) || 0;
}

/**
 * Map Kitty event type number to TUI event type string.
 * Per Kitty spec, default (no event type) = press.
 * - 0 (not specified) → "keydown" (default is press per spec)
 * - 1 (press) → "keydown"
 * - 2 (repeat) → "keypress" (held key)
 * - 3 (release) → "keyup"
 */
function kittyEventType(eventType: number): "keypress" | "keydown" | "keyup" {
    switch (eventType) {
        case 2:
            return "keypress";
        case 3:
            return "keyup";
        default:
            return "keydown";
    }
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

    // Collect parameter bytes (0x30–0x3f: digits, semicolons, colons, <, =, >, ?)
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

    // Split semicolon-separated parameters, keeping raw strings for sub-parameter parsing
    const paramStrings = params ? params.split(";") : [];

    // ── Kitty Keyboard Protocol: CSI <codepoint[:shifted[:base]]> ; <mod[:eventtype]> [; <text>] u ──
    if (finalByte === "u") {
        const codepoint = parseCodepointParam(paramStrings[0] ?? "0");
        const { mod, eventType } = parseModifierParam(paramStrings[1] ?? "");
        const mods = decodeModifiers(mod);
        const type = kittyEventType(eventType);

        const kittyKey = kittyCodepointMap[codepoint];
        if (kittyKey) {
            return {
                event: createKeyPressEvent(kittyKey.key, raw, {
                    ...mods,
                    type,
                    code: kittyKey.code ?? kittyKey.key,
                }),
                nextIndex,
            };
        }

        // Standard Unicode codepoint
        const key = String.fromCodePoint(codepoint);
        return { event: createKeyPressEvent(key, raw, { ...mods, type }), nextIndex };
    }

    // ── Tilde sequences: CSI <number> ; <modifier[:eventtype]>? ~ ──
    if (finalByte === "~") {
        const num = parseCodepointParam(paramStrings[0] ?? "0");
        const { mod, eventType } = parseModifierParam(paramStrings[1] ?? "");
        const keyName = tildeKeyMap[num];
        if (!keyName) return null;
        const mods = decodeModifiers(mod);
        const type = kittyEventType(eventType);
        return { event: createKeyPressEvent(keyName, raw, { ...mods, type }), nextIndex };
    }

    // ── Cursor / navigation / F1–F4: CSI <1;mod[:eventtype]>? <letter> ──
    const keyName = csiKeyMap[finalByte];
    if (keyName) {
        const { mod, eventType } = parseModifierParam(paramStrings.length >= 2 ? (paramStrings[1] ?? "") : "");
        const mods = decodeModifiers(mod);
        const type = kittyEventType(eventType);
        return { event: createKeyPressEvent(keyName, raw, { ...mods, type }), nextIndex };
    }

    // Unknown CSI sequence
    return null;
}
