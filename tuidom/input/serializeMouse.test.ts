import { describe, expect, it } from "vitest";

import type { MouseToken } from "./rawTerminalToken.ts";
import { serializeMouse, type SerializeMouseInit } from "./serializeMouse.ts";
import { tokenize } from "./tokenize.ts";

/** Serialize, tokenize back and assert a single mouse token came out. */
function roundTrip(init: SerializeMouseInit): MouseToken {
    const tokens = tokenize(serializeMouse(init));
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("mouse");
    return tokens[0] as MouseToken;
}

describe("serializeMouse", () => {
    // ─── Wire format ───

    it("serializes a left press as SGR with the 'M' final byte", () => {
        expect(serializeMouse({ action: "press", button: "left", x: 1, y: 1 })).toBe("\x1b[<0;1;1M");
    });

    it("serializes a release with the 'm' final byte", () => {
        expect(serializeMouse({ action: "release", button: "left", x: 10, y: 20 })).toBe("\x1b[<0;10;20m");
    });

    it("serializes middle and right buttons", () => {
        expect(serializeMouse({ action: "press", button: "middle", x: 2, y: 3 })).toBe("\x1b[<1;2;3M");
        expect(serializeMouse({ action: "press", button: "right", x: 2, y: 3 })).toBe("\x1b[<2;2;3M");
    });

    it("sets the motion bit for move", () => {
        expect(serializeMouse({ action: "move", button: "left", x: 4, y: 5 })).toBe("\x1b[<32;4;5M");
    });

    it("encodes the scroll wheel at 64 + direction", () => {
        expect(serializeMouse({ action: "scroll-up", x: 1, y: 1 })).toBe("\x1b[<64;1;1M");
        expect(serializeMouse({ action: "scroll-down", x: 1, y: 1 })).toBe("\x1b[<65;1;1M");
        expect(serializeMouse({ action: "scroll-left", x: 1, y: 1 })).toBe("\x1b[<66;1;1M");
        expect(serializeMouse({ action: "scroll-right", x: 1, y: 1 })).toBe("\x1b[<67;1;1M");
    });

    it("ors in the modifier bits", () => {
        expect(serializeMouse({ action: "press", button: "left", x: 1, y: 1, shiftKey: true })).toBe("\x1b[<4;1;1M");
        expect(serializeMouse({ action: "press", button: "left", x: 1, y: 1, altKey: true })).toBe("\x1b[<8;1;1M");
        expect(serializeMouse({ action: "press", button: "left", x: 1, y: 1, ctrlKey: true })).toBe("\x1b[<16;1;1M");
        expect(
            serializeMouse({
                action: "press",
                button: "left",
                x: 1,
                y: 1,
                shiftKey: true,
                altKey: true,
                ctrlKey: true,
            }),
        ).toBe("\x1b[<28;1;1M");
    });

    it("defaults the button to 'none'", () => {
        expect(serializeMouse({ action: "press", x: 7, y: 8 })).toBe("\x1b[<3;7;8M");
    });

    // ─── Round-trip through the real tokenizer ───

    it("round-trips a left click press", () => {
        const t = roundTrip({ action: "press", button: "left", x: 10, y: 20 });
        expect(t.button).toBe("left");
        expect(t.action).toBe("press");
        expect(t.x).toBe(10);
        expect(t.y).toBe(20);
    });

    it("round-trips a right release", () => {
        const t = roundTrip({ action: "release", button: "right", x: 3, y: 4 });
        expect(t.button).toBe("right");
        expect(t.action).toBe("release");
    });

    it("round-trips a drag (move with a held button)", () => {
        const t = roundTrip({ action: "move", button: "left", x: 5, y: 6 });
        expect(t.button).toBe("left");
        expect(t.action).toBe("move");
    });

    it("round-trips every wheel direction", () => {
        for (const action of ["scroll-up", "scroll-down", "scroll-left", "scroll-right"] as const) {
            const t = roundTrip({ action, x: 2, y: 2 });
            expect(t.action).toBe(action);
            expect(t.button).toBe("none");
        }
    });

    it("round-trips modifiers", () => {
        const t = roundTrip({ action: "press", button: "left", x: 1, y: 1, shiftKey: true, ctrlKey: true });
        expect(t.shiftKey).toBe(true);
        expect(t.ctrlKey).toBe(true);
        expect(t.altKey).toBe(false);
    });
});
