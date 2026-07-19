import { convertTokenToKeyPressEvent } from "./convertToken.ts";
import type { KeyPressEvent } from "./keyEvent.ts";
import type { RawKeyToken } from "./rawTerminalToken.ts";
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
    const keyTokens = tokenize(data).filter(
        (t) => t.kind !== "mouse" && t.kind !== "osc" && t.kind !== "device-report" && t.kind !== "unknown-csi",
    ) as RawKeyToken[];
    return keyTokens.map(convertTokenToKeyPressEvent);
}
