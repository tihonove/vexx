import { createKeyPressEvent, type KeyPressEvent } from "./KeyEvent.ts";
import type { RawTerminalToken } from "./TokenParsing/RawTerminalToken.ts";

/**
 * Map Kitty event type number to TUI event type string.
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

export function convertTokenToKeyPressEvent(token: RawTerminalToken): KeyPressEvent {
    switch (token.kind) {
        case "csi-u":
            return createKeyPressEvent(token.key, token.raw, {
                type: kittyEventType(token.eventType),
                code: token.code,
                shiftKey: token.shiftKey,
                altKey: token.altKey,
                ctrlKey: token.ctrlKey,
                metaKey: token.metaKey,
            });

        case "csi-letter":
            return createKeyPressEvent(token.key, token.raw, {
                type: kittyEventType(token.eventType),
                shiftKey: token.shiftKey,
                altKey: token.altKey,
                ctrlKey: token.ctrlKey,
                metaKey: token.metaKey,
            });

        case "csi-tilde":
            return createKeyPressEvent(token.key, token.raw, {
                type: kittyEventType(token.eventType),
                shiftKey: token.shiftKey,
                altKey: token.altKey,
                ctrlKey: token.ctrlKey,
                metaKey: token.metaKey,
            });

        case "ss3":
            return createKeyPressEvent(token.key, token.raw);

        case "pua":
            return createKeyPressEvent(token.key, token.raw, {
                type: "keydown",
                code: token.code,
            });

        case "esc-char":
            return createKeyPressEvent(token.char, token.raw, { altKey: true });

        case "esc-control":
            return createKeyPressEvent(token.letter, token.raw, {
                altKey: true,
                ctrlKey: true,
                code: `Key${token.letter.toUpperCase()}`,
            });

        case "esc-special":
            return createKeyPressEvent(token.key, token.raw, { altKey: true });

        case "standalone-esc":
            return createKeyPressEvent("Escape", token.raw);

        case "char":
            return createKeyPressEvent(token.char, token.raw);

        case "special-key":
            return createKeyPressEvent(token.key, token.raw);

        case "ctrl-char":
            return createKeyPressEvent(token.letter, token.raw, {
                ctrlKey: true,
                code: token.letter === " " ? "Space" : `Key${token.letter.toUpperCase()}`,
            });

        case "unknown-byte":
            return createKeyPressEvent(`<0x${token.byte.toString(16).padStart(2, "0")}>`, token.raw);
    }
}
