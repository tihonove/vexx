/**
 * Convert a mouse event description to the raw SGR (1006) terminal sequence.
 * Inverse of the mouse branch of `tokenize` — the counterpart of
 * {@link import("./serializeKey.ts").serializeKey} for the pointer:
 *   serializeMouse({ action: "press", button: "left", x: 1, y: 1 })    → '\x1b[<0;1;1M'
 *   serializeMouse({ action: "release", button: "left", x: 4, y: 2 })  → '\x1b[<0;4;2m'
 *   serializeMouse({ action: "scroll-down", x: 4, y: 2 })              → '\x1b[<65;4;2M'
 *   serializeMouse({ action: "move", button: "left", x: 4, y: 2 })     → '\x1b[<32;4;2M'
 *
 * Coordinates are 1-based, exactly as they arrive from a terminal and as
 * {@link MouseToken} carries them.
 */

import type { MouseAction, MouseButton } from "./rawTerminalToken.ts";

export interface SerializeMouseInit {
    action: MouseAction;
    /** Defaults to `"none"` — the only meaningful button for scroll actions. */
    button?: MouseButton;
    /** 1-based column */
    x: number;
    /** 1-based row */
    y: number;
    shiftKey?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
}

/** Bits 0-1 of the button byte. `none` maps to 3, the "no button" encoding. */
const buttonBits: Record<MouseButton, number> = { left: 0, middle: 1, right: 2, none: 3 };

/** Scroll actions live at 64 + wheel direction (up/down/left/right). */
const scrollBits: Partial<Record<MouseAction, number>> = {
    "scroll-up": 64,
    "scroll-down": 65,
    "scroll-left": 66,
    "scroll-right": 67,
};

export function serializeMouse(init: SerializeMouseInit): string {
    const { action, x, y } = init;
    const button = init.button ?? "none";

    let cb = scrollBits[action] ?? buttonBits[button];
    if (action === "move") cb |= 32;
    if (init.shiftKey === true) cb |= 4;
    if (init.altKey === true) cb |= 8;
    if (init.ctrlKey === true) cb |= 16;

    // SGR distinguishes release from press by the final byte, not by the button
    // bits — that is exactly why we speak 1006 and not the legacy X10 form.
    const finalByte = action === "release" ? "m" : "M";
    return `\x1b[<${String(cb)};${String(x)};${String(y)}${finalByte}`;
}
