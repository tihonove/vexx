/**
 * TUI event types — web-style keyboard events with individual modifier flags.
 *
 * KeyPressEvent follows the DOM KeyboardEvent naming conventions:
 * - `key`  — the value produced by the key ("a", "Enter", "ArrowUp")
 * - `code` — the physical key identifier ("KeyA", "Enter", "ArrowUp")
 * - Boolean modifier flags: ctrlKey, shiftKey, altKey, metaKey
 *
 * Discriminated union `TUIEvent` is extensible for future event types (click, focus, etc.)
 */

export interface KeyPressEvent {
    readonly type: "keypress";

    /**
     * Key value, following the DOM KeyboardEvent.key naming convention.
     *
     * For printable characters: the character itself ("a", "A", "1", "!")
     * For Ctrl+letter: just the lowercase letter ("c", not "Ctrl+C")
     * For special keys: DOM name ("Enter", "ArrowUp", "F1", "Escape", etc.)
     */
    readonly key: string;

    /**
     * Physical key code, following the DOM KeyboardEvent.code naming convention.
     *
     * "KeyA", "Digit1", "Space", "Enter", "ArrowUp", "F1", etc.
     */
    readonly code: string;

    readonly ctrlKey: boolean;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
    readonly metaKey: boolean;

    /** Original raw bytes from the terminal (for debugging) */
    readonly raw: string;
}

/** Discriminated union of all TUI events (extensible for click, focus, etc.) */
export type TUIEvent = KeyPressEvent;

/** Helper to create a KeyPressEvent with sensible defaults */
export function createKeyPressEvent(
    key: string,
    raw: string,
    overrides?: Partial<Omit<KeyPressEvent, "type">>,
): KeyPressEvent {
    return {
        type: "keypress",
        key,
        code: overrides?.code ?? inferCode(key),
        ctrlKey: overrides?.ctrlKey ?? false,
        shiftKey: overrides?.shiftKey ?? false,
        altKey: overrides?.altKey ?? false,
        metaKey: overrides?.metaKey ?? false,
        raw,
    };
}

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
