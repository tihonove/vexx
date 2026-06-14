import { describe, expect, it } from "vitest";

import { convertTokenToKeyPressEvent } from "./convertToken.ts";
import type { UnknownByteToken } from "./RawTerminalToken.ts";

describe("convertTokenToKeyPressEvent — unknown-byte", () => {
    it("converts an unknown control byte to a <0xNN> key, zero-padded to two hex digits", () => {
        const token: UnknownByteToken = { kind: "unknown-byte", byte: 0xff, raw: "\xff" };
        const event = convertTokenToKeyPressEvent(token);

        expect(event.key).toBe("<0xff>");
        expect(event.raw).toBe("\xff");
        expect(event.type).toBe("keydown");
    });

    it("pads single-digit byte values (0x05 → <0x05>)", () => {
        const token: UnknownByteToken = { kind: "unknown-byte", byte: 0x05, raw: "\x05" };
        expect(convertTokenToKeyPressEvent(token).key).toBe("<0x05>");
    });
});
