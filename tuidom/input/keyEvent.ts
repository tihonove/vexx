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

import { inferCode } from "./tokenize.ts";

export interface KeyPressEvent {
    /**
     * Event type, following DOM KeyboardEvent naming:
     * - "keypress" — synthesized companion event for printable input (legacy)
     * - "keydown"  — key press or auto-repeat (Kitty event type 1 or 2)
     * - "keyup"    — key release (Kitty event type 3)
     */
    readonly type: "keypress" | "keydown" | "keyup";

    /**
     * Key value, following the DOM KeyboardEvent.key naming convention.
     *
     * For printable characters: the character itself ("a", "A", "1", "!")
     * For Ctrl+letter: just the lowercase letter ("c", not "Ctrl+C")
     * For special keys: DOM name ("Enter", "ArrowUp", "F1", "Escape", etc.)
     * For modifier keys: "Shift", "Control", "Alt", "Meta" (Kitty protocol)
     */
    readonly key: string;

    /**
     * Physical key code, following the DOM KeyboardEvent.code naming convention.
     *
     * "KeyA", "Digit1", "Space", "Enter", "ArrowUp", "F1", etc.
     * For modifier keys: "ShiftLeft", "ControlLeft", "AltLeft", "MetaLeft", etc.
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
export function createKeyPressEvent(key: string, raw: string, overrides?: Partial<KeyPressEvent>): KeyPressEvent {
    return {
        type: overrides?.type ?? "keydown",
        key,
        code: overrides?.code ?? inferCode(key),
        ctrlKey: overrides?.ctrlKey ?? false,
        shiftKey: overrides?.shiftKey ?? false,
        altKey: overrides?.altKey ?? false,
        metaKey: overrides?.metaKey ?? false,
        raw,
    };
}

// inferCode re-exported from TokenParsing layer
export { inferCode } from "./tokenize.ts";
