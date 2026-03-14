import type { RawTerminalToken, CsiUToken, CsiLetterToken, CsiTildeToken } from "./RawTerminalToken.ts";

/**
 * Tokenize raw terminal input into protocol-specific RawTerminalToken[].
 *
 * Pure function, no side effects.
 * Returns a discriminated union of token types preserving the wire format semantics:
 * - Kitty CSI u, PUA characters
 * - Standard CSI letter/tilde, SS3
 * - Legacy ESC-prefixed, control chars, printable chars
 */
export function tokenize(data: string): RawTerminalToken[] {
    const tokens: RawTerminalToken[] = [];
    let i = 0;

    while (i < data.length) {
        const code = data.charCodeAt(i);

        if (code === 0x1b) {
            // Escape: could be standalone, CSI, SS3, or Alt+key
            if (i + 1 >= data.length) {
                tokens.push({ kind: "standalone-esc", raw: data[i] });
                i++;
                continue;
            }

            const next = data.charCodeAt(i + 1);

            if (next === 0x5b) {
                // CSI sequence: \x1b[ ...
                const csiResult = parseCSI(data, i);
                if (csiResult) {
                    tokens.push(csiResult.token);
                    i = csiResult.nextIndex;
                    continue;
                }
                // Failed to parse CSI — emit standalone Escape, let '[' be handled next iteration
                tokens.push({ kind: "standalone-esc", raw: data[i] });
                i++;
            } else if (next === 0x4f) {
                // SS3 sequence: \x1bO<letter>
                if (i + 2 < data.length) {
                    const letter = data[i + 2];
                    const keyName = ss3KeyMap[letter];
                    if (keyName) {
                        tokens.push({
                            kind: "ss3",
                            finalByte: letter,
                            key: keyName,
                            raw: data.slice(i, i + 3),
                        });
                        i += 3;
                        continue;
                    }
                }
                // Unknown SS3 — emit standalone Escape
                tokens.push({ kind: "standalone-esc", raw: data[i] });
                i++;
            } else if (next === 0x0d) {
                // ESC + Enter
                tokens.push({ kind: "esc-special", key: "Enter", raw: data.slice(i, i + 2) });
                i += 2;
            } else if (next === 0x7f) {
                // ESC + Backspace
                tokens.push({ kind: "esc-special", key: "Backspace", raw: data.slice(i, i + 2) });
                i += 2;
            } else if (next >= 0x01 && next <= 0x1a) {
                // ESC + control char (Alt+Ctrl+letter)
                const letter = String.fromCharCode(next + 0x60);
                tokens.push({ kind: "esc-control", letter, raw: data.slice(i, i + 2) });
                i += 2;
            } else if (next >= 0x20) {
                // ESC + printable character, or Kitty PUA functional key
                const kittyKey = kittyCodepointMap[next];
                if (kittyKey) {
                    tokens.push({
                        kind: "pua",
                        codepoint: next,
                        key: kittyKey.key,
                        code: kittyKey.code ?? kittyKey.key,
                        raw: data.slice(i, i + 2),
                    });
                } else {
                    tokens.push({
                        kind: "esc-char",
                        char: data[i + 1],
                        charCode: next,
                        raw: data.slice(i, i + 2),
                    });
                }
                i += 2;
            } else {
                // Escape followed by unknown byte — emit standalone Escape
                tokens.push({ kind: "standalone-esc", raw: data[i] });
                i++;
            }
        } else if (code === 0x00) {
            // Ctrl+Space (NUL)
            tokens.push({ kind: "ctrl-char", letter: " ", raw: data[i] });
            i++;
        } else if (code === 0x0d) {
            tokens.push({ kind: "special-key", key: "Enter", raw: data[i] });
            i++;
        } else if (code === 0x09) {
            tokens.push({ kind: "special-key", key: "Tab", raw: data[i] });
            i++;
        } else if (code === 0x7f) {
            tokens.push({ kind: "special-key", key: "Backspace", raw: data[i] });
            i++;
        } else if (code >= 0x01 && code <= 0x1a) {
            // Ctrl+A through Ctrl+Z
            const letter = String.fromCharCode(code + 0x60);
            tokens.push({ kind: "ctrl-char", letter, raw: data[i] });
            i++;
        } else if (code >= 0x20) {
            // Printable character or Kitty PUA functional key
            const kittyKey = kittyCodepointMap[code];
            if (kittyKey) {
                tokens.push({
                    kind: "pua",
                    codepoint: code,
                    key: kittyKey.key,
                    code: kittyKey.code ?? kittyKey.key,
                    raw: data[i],
                });
            } else {
                tokens.push({ kind: "char", char: data[i], codepoint: code, raw: data[i] });
            }
            i++;
        } else {
            // Unknown control character
            tokens.push({ kind: "unknown-byte", byte: code, raw: data[i] });
            i++;
        }
    }

    return tokens;
}

// ─── Kitty functional key codepoints ───

/**
 * Map Kitty Keyboard Protocol codepoints (Private Use Area U+E000+) to DOM-style key/code.
 * Also includes standard codepoints used in CSI u for common keys (Enter, Tab, etc.).
 *
 * Reference: https://sw.kovidgoyal.net/kitty/keyboard-protocol/#functional-key-definitions
 */
export const kittyCodepointMap: Partial<Record<number, { key: string; code?: string }>> = {
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
export const csiKeyMap: Partial<Record<string, string>> = {
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
export const tildeKeyMap: Partial<Record<number, string>> = {
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
export const ss3KeyMap: Partial<Record<string, string>> = {
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
export function decodeModifiers(mod: number): {
    shiftKey: boolean;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
} {
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
 * Returns { codepoint, shiftedKey, baseLayoutKey }.
 */
function parseCodepointParam(paramStr: string): {
    codepoint: number;
    shiftedKey: number | undefined;
    baseLayoutKey: number | undefined;
} {
    const parts = paramStr.split(":");
    const codepoint = parts[0] === undefined || parts[0] === "" ? 0 : parseInt(parts[0], 10) || 0;
    const shiftedKey = parts[1] !== undefined && parts[1] !== "" ? parseInt(parts[1], 10) || undefined : undefined;
    const baseLayoutKey = parts[2] !== undefined && parts[2] !== "" ? parseInt(parts[2], 10) || undefined : undefined;
    return { codepoint, shiftedKey, baseLayoutKey };
}

// ─── Code inference ───

/**
 * Infer a DOM-style `code` from a key value.
 * Best-effort for traditional terminal mode (no physical key info available).
 */
export function inferCode(key: string): string {
    if (key.length === 1) {
        const upper = key.toUpperCase();
        if (upper >= "A" && upper <= "Z") return `Key${upper}`;
        if (key >= "0" && key <= "9") return `Digit${key}`;
        if (key === " ") return "Space";

        const punctuation: Record<string, string> = {
            "-": "Minus",
            "=": "Equal",
            "[": "BracketLeft",
            "]": "BracketRight",
            "\\": "Backslash",
            ";": "Semicolon",
            "'": "Quote",
            ",": "Comma",
            ".": "Period",
            "/": "Slash",
            "`": "Backquote",
        };
        return punctuation[key] ?? key;
    }
    // Named keys: code matches key ("Enter", "ArrowUp", "F1", etc.)
    return key;
}

// ─── CSI parser ───

interface CSITokenResult {
    token: CsiUToken | CsiLetterToken | CsiTildeToken;
    nextIndex: number;
}

/**
 * Parse a CSI sequence starting at data[start] = ESC, data[start+1] = '['.
 * Returns the parsed token and next index, or null if the sequence is not recognized.
 */
function parseCSI(data: string, start: number): CSITokenResult | null {
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
        const { codepoint, shiftedKey, baseLayoutKey } = parseCodepointParam(paramStrings[0] ?? "0");
        const { mod, eventType } = parseModifierParam(paramStrings[1] ?? "");
        const mods = decodeModifiers(mod);

        const kittyKey = kittyCodepointMap[codepoint];
        const key = kittyKey ? kittyKey.key : String.fromCodePoint(codepoint);
        const code = kittyKey ? (kittyKey.code ?? kittyKey.key) : inferCode(key);

        const token: CsiUToken = {
            kind: "csi-u",
            codepoint,
            shiftedKey,
            baseLayoutKey,
            key,
            code,
            ...mods,
            eventType,
            raw,
        };
        return { token, nextIndex };
    }

    // ── Tilde sequences: CSI <number> ; <modifier[:eventtype]>? ~ ──
    if (finalByte === "~") {
        const { codepoint: num } = parseCodepointParam(paramStrings[0] ?? "0");
        const { mod, eventType } = parseModifierParam(paramStrings[1] ?? "");
        const keyName = tildeKeyMap[num];
        if (!keyName) return null;
        const mods = decodeModifiers(mod);
        const token: CsiTildeToken = {
            kind: "csi-tilde",
            number: num,
            key: keyName,
            ...mods,
            eventType,
            raw,
        };
        return { token, nextIndex };
    }

    // ── Cursor / navigation / F1–F4: CSI <1;mod[:eventtype]>? <letter> ──
    const keyName = csiKeyMap[finalByte];
    if (keyName) {
        const { mod, eventType } = parseModifierParam(paramStrings.length >= 2 ? (paramStrings[1] ?? "") : "");
        const mods = decodeModifiers(mod);
        const token: CsiLetterToken = {
            kind: "csi-letter",
            finalByte,
            key: keyName,
            ...mods,
            eventType,
            raw,
        };
        return { token, nextIndex };
    }

    // Unknown CSI sequence
    return null;
}
