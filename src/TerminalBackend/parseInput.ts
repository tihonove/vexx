import type { KeyPressEvent } from "./KeyEvent.ts";
import { tokenize } from "./TokenParsing/tokenize.ts";
import { convertTokenToKeyPressEvent } from "./convertToken.ts";

/**
 * Parse raw terminal input into KeyPressEvent[].
 *
 * Composes tokenize() (protocol-specific token extraction) with
 * convertTokenToKeyPressEvent() (unified KeyPressEvent mapping).
 *
 * Pure function, no side effects.
 */
export function parseInput(data: string): KeyPressEvent[] {
    return tokenize(data).map(convertTokenToKeyPressEvent);
}
