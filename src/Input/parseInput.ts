import { convertTokenToKeyPressEvent } from "./convertToken.ts";
import type { KeyPressEvent } from "./KeyEvent.ts";
import { tokenize } from "./tokenize.ts";

/**
 * Parse raw terminal input into KeyPressEvent[].
 *
 * Composes tokenize() (protocol-specific token extraction) with
 * convertTokenToKeyPressEvent() (unified KeyPressEvent mapping).
 *
 * Mouse tokens are filtered out — they are handled separately
 * at the tokenize layer (see MouseToken in RawTerminalToken).
 *
 * Pure function, no side effects.
 */
export function parseInput(data: string): KeyPressEvent[] {
    return tokenize(data)
        .filter((t) => t.kind !== "mouse")
        .map(convertTokenToKeyPressEvent);
}
