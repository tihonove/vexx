import { describe, expect, it } from "vitest";

import type { CsiUToken, PuaToken } from "./RawTerminalToken.ts";
import { tokenize } from "./tokenize.ts";

/**
 * Branch-level edge cases for the tokenizer: incomplete sequences, defensive
 * fallbacks in the Kitty parameter parsers, and malformed CSI sequences that
 * must degrade gracefully to a standalone Escape.
 */
describe("tokenize — incomplete / unknown ESC sequences", () => {
    it("emits standalone-esc for an incomplete SS3 (\\x1bO at end of buffer)", () => {
        // i + 2 is past the end → cannot read the SS3 final letter (tokenize.ts:62).
        const tokens = tokenize("\x1bO");
        expect(tokens).toHaveLength(2);
        expect(tokens[0]).toEqual({ kind: "standalone-esc", raw: "\x1b" });
        expect(tokens[1]).toMatchObject({ kind: "char", char: "O" });
    });

    it("emits standalone-esc for a bare CSI introducer with no final byte (\\x1b[)", () => {
        // parseCSI runs off the end before a final byte (tokenize.ts:466).
        const tokens = tokenize("\x1b[");
        expect(tokens).toHaveLength(2);
        expect(tokens[0]).toEqual({ kind: "standalone-esc", raw: "\x1b" });
        expect(tokens[1]).toMatchObject({ kind: "char", char: "[" });
    });

    it("emits standalone-esc when the CSI final byte is out of range (\\x1b[\\x7f)", () => {
        // 0x7f is neither a parameter, intermediate, nor a valid final byte (tokenize.ts:468).
        const tokens = tokenize("\x1b[\x7f");
        expect(tokens[0]).toEqual({ kind: "standalone-esc", raw: "\x1b" });
        expect(tokens.some((t) => t.kind === "csi-letter" || t.kind === "csi-u")).toBe(false);
    });
});

describe("tokenize — PUA functional keys without an explicit code", () => {
    it("standalone PUA with key-only mapping falls back to key as code (Pause = 57362)", () => {
        // kittyCodepointMap[57362] = { key: "Pause" } has no `code` → code falls back to key (tokenize.ts:143).
        const pause = String.fromCodePoint(57362);
        const tokens = tokenize(pause);
        expect(tokens).toEqual([
            { kind: "pua", codepoint: 57362, key: "Pause", code: "Pause", raw: pause },
        ]);
    });

    it("ESC+PUA with key-only mapping falls back to key as code (Alt+Pause)", () => {
        // Same fallback on the ESC-prefixed PUA path (tokenize.ts:100).
        const pause = String.fromCodePoint(57362);
        const tokens = tokenize("\x1b" + pause);
        const token = tokens[0] as PuaToken;
        expect(token).toMatchObject({ kind: "pua", codepoint: 57362, key: "Pause", code: "Pause" });
        expect(token.raw).toBe("\x1b" + pause);
    });
});

describe("tokenize — Kitty CSI u parameter fallbacks", () => {
    it("modifier with empty value before the colon falls back to no modifiers (\\x1b[97;:2u)", () => {
        // parseModifierParam(":2"): substring before ':' is empty → mod defaults to 1 (tokenize.ts:384).
        const token = tokenize("\x1b[97;:2u")[0] as CsiUToken;
        expect(token).toMatchObject({
            kind: "csi-u",
            codepoint: 97,
            eventType: 2,
            shiftKey: false,
            altKey: false,
            ctrlKey: false,
            metaKey: false,
        });
    });

    it("modifier with empty event-type after the colon falls back to eventType 1 (\\x1b[97;5:u)", () => {
        // parseModifierParam("5:"): substring after ':' is empty → eventType defaults to 1 (tokenize.ts:385).
        const token = tokenize("\x1b[97;5:u")[0] as CsiUToken;
        expect(token).toMatchObject({ kind: "csi-u", codepoint: 97, ctrlKey: true, eventType: 1 });
    });

    it("modifier value of 0 (no colon) falls back to no modifiers (\\x1b[97;0u)", () => {
        // parseModifierParam("0"): parseInt is falsy → mod defaults to 1 (tokenize.ts:388).
        const token = tokenize("\x1b[97;0u")[0] as CsiUToken;
        expect(token).toMatchObject({
            kind: "csi-u",
            codepoint: 97,
            eventType: 0,
            shiftKey: false,
            altKey: false,
            ctrlKey: false,
            metaKey: false,
        });
    });

    it("empty codepoint field decodes to codepoint 0 (\\x1b[;5u)", () => {
        // parseCodepointParam(""): parts[0] === "" → codepoint 0 (tokenize.ts:401).
        const token = tokenize("\x1b[;5u")[0] as CsiUToken;
        expect(token).toMatchObject({ kind: "csi-u", codepoint: 0, ctrlKey: true });
    });

    it("codepoint field of '0' decodes to codepoint 0 (\\x1b[0u)", () => {
        // parseCodepointParam("0"): parseInt is falsy → codepoint 0 (tokenize.ts:401).
        const token = tokenize("\x1b[0u")[0] as CsiUToken;
        expect(token).toMatchObject({ kind: "csi-u", codepoint: 0 });
    });

    it("bare CSI u with no parameters decodes to codepoint 0 (\\x1b[u)", () => {
        // paramStrings is empty → parseCodepointParam falls back to "0" (tokenize.ts:494).
        const token = tokenize("\x1b[u")[0] as CsiUToken;
        expect(token).toMatchObject({ kind: "csi-u", codepoint: 0 });
    });

    it("shifted-key sub-field of '0' is treated as absent (\\x1b[97:0;1u)", () => {
        // parseCodepointParam("97:0"): parseInt(parts[1]) is falsy → shiftedKey undefined (tokenize.ts:402).
        const token = tokenize("\x1b[97:0;1u")[0] as CsiUToken;
        expect(token).toMatchObject({ kind: "csi-u", codepoint: 97, shiftedKey: undefined });
    });

    it("base-layout sub-field of '0' is treated as absent (\\x1b[97::0;1u)", () => {
        // parseCodepointParam("97::0"): parseInt(parts[2]) is falsy → baseLayoutKey undefined (tokenize.ts:403).
        const token = tokenize("\x1b[97::0;1u")[0] as CsiUToken;
        expect(token).toMatchObject({
            kind: "csi-u",
            codepoint: 97,
            shiftedKey: undefined,
            baseLayoutKey: undefined,
        });
    });
});

describe("tokenize — malformed tilde and mouse sequences", () => {
    it("bare CSI ~ with no number is a complete unknown sequence → unknown-csi (\\x1b[~)", () => {
        // parseCodepointParam falls back to "0", tildeKeyMap[0] is undefined; the sequence is
        // complete (final byte '~') so it is consumed and dropped rather than typed as text.
        const tokens = tokenize("\x1b[~");
        expect(tokens).toEqual([{ kind: "unknown-csi", raw: "\x1b[~" }]);
        expect(tokens.some((t) => t.kind === "csi-tilde")).toBe(false);
    });

    it("modifyOtherKeys with an unknown encoded codepoint → unknown-csi (\\x1b[27;5;99~)", () => {
        // num === 27 but kittyCodepointMap[99] is undefined → keyName stays undefined; complete → dropped.
        const tokens = tokenize("\x1b[27;5;99~");
        expect(tokens).toEqual([{ kind: "unknown-csi", raw: "\x1b[27;5;99~" }]);
        expect(tokens.some((t) => t.kind === "csi-tilde")).toBe(false);
    });

    it("SGR mouse without exactly three parameters is a complete unknown sequence → unknown-csi (\\x1b[<0;10M)", () => {
        // parts.length !== 3 → the SGR branch falls through; final byte 'M' present → dropped, not typed.
        const tokens = tokenize("\x1b[<0;10M");
        expect(tokens).toEqual([{ kind: "unknown-csi", raw: "\x1b[<0;10M" }]);
        expect(tokens.some((t) => t.kind === "mouse")).toBe(false);
    });

    it("SGR mouse with zero coordinates clamps x/y to 1 (\\x1b[<0;0;0M)", () => {
        // parseInt of "0" is falsy → cx and cy default to 1 (tokenize.ts:552-553).
        const tokens = tokenize("\x1b[<0;0;0M");
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({ kind: "mouse", button: "left", action: "press", x: 1, y: 1 });
    });

    it("legacy mouse without its 3 trailing bytes is rejected → standalone-esc (\\x1b[M)", () => {
        // nextIndex + 2 is past the end → not enough bytes for the legacy payload (tokenize.ts:574).
        const tokens = tokenize("\x1b[M");
        expect(tokens[0]).toEqual({ kind: "standalone-esc", raw: "\x1b" });
        expect(tokens.some((t) => t.kind === "mouse")).toBe(false);
    });
});

describe("tokenize — OSC bodies without a semicolon", () => {
    it("OSC body with no semicolon uses the whole body as the code (\\x1b]7\\x07)", () => {
        // body.indexOf(";") < 0 → codeStr = body, data = "" (tokenize.ts:701-703).
        const tokens = tokenize("\x1b]7\x07");
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({ kind: "osc", code: 7, data: "" });
    });

    it("OSC with an empty / non-numeric code yields code -1 (\\x1b]\\x07)", () => {
        // parseInt("") is NaN → code falls back to -1 (tokenize.ts:705).
        const tokens = tokenize("\x1b]\x07");
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({ kind: "osc", code: -1, data: "" });
    });
});
