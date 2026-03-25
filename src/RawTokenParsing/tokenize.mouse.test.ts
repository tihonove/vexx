import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenize.ts";
import type { MouseToken } from "./RawTerminalToken.ts";

function mouseToken(tokens: ReturnType<typeof tokenize>): MouseToken {
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("mouse");
    return tokens[0] as MouseToken;
}

describe("tokenize.mouse — SGR extended mode", () => {
    // ─── Basic button press ───

    it("parses SGR left click press", () => {
        // \x1b[<0;10;20M  — button 0 = left, x=10, y=20, press (M)
        const t = mouseToken(tokenize("\x1b[<0;10;20M"));
        expect(t.button).toBe("left");
        expect(t.action).toBe("press");
        expect(t.x).toBe(10);
        expect(t.y).toBe(20);
        expect(t.shiftKey).toBe(false);
        expect(t.altKey).toBe(false);
        expect(t.ctrlKey).toBe(false);
    });

    it("parses SGR middle click press", () => {
        const t = mouseToken(tokenize("\x1b[<1;5;5M"));
        expect(t.button).toBe("middle");
        expect(t.action).toBe("press");
        expect(t.x).toBe(5);
        expect(t.y).toBe(5);
    });

    it("parses SGR right click press", () => {
        const t = mouseToken(tokenize("\x1b[<2;1;1M"));
        expect(t.button).toBe("right");
        expect(t.action).toBe("press");
        expect(t.x).toBe(1);
        expect(t.y).toBe(1);
    });

    // ─── Button release ───

    it("parses SGR left click release", () => {
        // \x1b[<0;10;20m  — finalByte 'm' = release
        const t = mouseToken(tokenize("\x1b[<0;10;20m"));
        expect(t.button).toBe("left");
        expect(t.action).toBe("release");
        expect(t.x).toBe(10);
        expect(t.y).toBe(20);
    });

    it("parses SGR right click release", () => {
        const t = mouseToken(tokenize("\x1b[<2;50;30m"));
        expect(t.button).toBe("right");
        expect(t.action).toBe("release");
        expect(t.x).toBe(50);
        expect(t.y).toBe(30);
    });

    // ─── Modifiers ───

    it("parses SGR Shift+left click", () => {
        // Shift = bit 2 → cb = 0 + 4 = 4
        const t = mouseToken(tokenize("\x1b[<4;10;20M"));
        expect(t.button).toBe("left");
        expect(t.action).toBe("press");
        expect(t.shiftKey).toBe(true);
        expect(t.altKey).toBe(false);
        expect(t.ctrlKey).toBe(false);
    });

    it("parses SGR Alt+left click", () => {
        // Alt = bit 3 → cb = 0 + 8 = 8
        const t = mouseToken(tokenize("\x1b[<8;10;20M"));
        expect(t.button).toBe("left");
        expect(t.action).toBe("press");
        expect(t.shiftKey).toBe(false);
        expect(t.altKey).toBe(true);
        expect(t.ctrlKey).toBe(false);
    });

    it("parses SGR Ctrl+left click", () => {
        // Ctrl = bit 4 → cb = 0 + 16 = 16
        const t = mouseToken(tokenize("\x1b[<16;10;20M"));
        expect(t.button).toBe("left");
        expect(t.action).toBe("press");
        expect(t.shiftKey).toBe(false);
        expect(t.altKey).toBe(false);
        expect(t.ctrlKey).toBe(true);
    });

    it("parses SGR Ctrl+Shift+right click", () => {
        // right=2, Shift=4, Ctrl=16 → cb = 2 + 4 + 16 = 22
        const t = mouseToken(tokenize("\x1b[<22;3;7M"));
        expect(t.button).toBe("right");
        expect(t.action).toBe("press");
        expect(t.shiftKey).toBe(true);
        expect(t.altKey).toBe(false);
        expect(t.ctrlKey).toBe(true);
        expect(t.x).toBe(3);
        expect(t.y).toBe(7);
    });

    it("parses SGR Ctrl+Alt+Shift+middle click", () => {
        // middle=1, Shift=4, Alt=8, Ctrl=16 → cb = 1+4+8+16 = 29
        const t = mouseToken(tokenize("\x1b[<29;1;1M"));
        expect(t.button).toBe("middle");
        expect(t.action).toBe("press");
        expect(t.shiftKey).toBe(true);
        expect(t.altKey).toBe(true);
        expect(t.ctrlKey).toBe(true);
    });

    // ─── Scroll ───

    it("parses SGR scroll up", () => {
        // scroll up = 64 + 0 = 64
        const t = mouseToken(tokenize("\x1b[<64;10;20M"));
        expect(t.button).toBe("none");
        expect(t.action).toBe("scroll-up");
        expect(t.x).toBe(10);
        expect(t.y).toBe(20);
    });

    it("parses SGR scroll down", () => {
        // scroll down = 64 + 1 = 65
        const t = mouseToken(tokenize("\x1b[<65;10;20M"));
        expect(t.button).toBe("none");
        expect(t.action).toBe("scroll-down");
    });

    it("parses SGR scroll left", () => {
        // scroll left = 64 + 2 = 66
        const t = mouseToken(tokenize("\x1b[<66;10;20M"));
        expect(t.button).toBe("none");
        expect(t.action).toBe("scroll-left");
    });

    it("parses SGR scroll right", () => {
        // scroll right = 64 + 3 = 67
        const t = mouseToken(tokenize("\x1b[<67;10;20M"));
        expect(t.button).toBe("none");
        expect(t.action).toBe("scroll-right");
    });

    it("parses SGR Ctrl+scroll up", () => {
        // Ctrl=16, scroll up=64 → cb = 64 + 16 = 80
        const t = mouseToken(tokenize("\x1b[<80;5;5M"));
        expect(t.action).toBe("scroll-up");
        expect(t.ctrlKey).toBe(true);
        expect(t.shiftKey).toBe(false);
    });

    it("parses SGR Shift+scroll down", () => {
        // Shift=4, scroll down=65 → cb = 65 + 4 = 69
        const t = mouseToken(tokenize("\x1b[<69;5;5M"));
        expect(t.action).toBe("scroll-down");
        expect(t.shiftKey).toBe(true);
    });

    // ─── Motion / drag ───

    it("parses SGR mouse move (no button)", () => {
        // motion=32, button 3 (none) = 32+3 = 35
        const t = mouseToken(tokenize("\x1b[<35;15;25M"));
        expect(t.button).toBe("none");
        expect(t.action).toBe("move");
        expect(t.x).toBe(15);
        expect(t.y).toBe(25);
    });

    it("parses SGR left button drag", () => {
        // motion=32, button 0 = 32
        const t = mouseToken(tokenize("\x1b[<32;15;25M"));
        expect(t.button).toBe("left");
        expect(t.action).toBe("move");
    });

    it("parses SGR right button drag", () => {
        // motion=32, button 2 = 34
        const t = mouseToken(tokenize("\x1b[<34;15;25M"));
        expect(t.button).toBe("right");
        expect(t.action).toBe("move");
    });

    // ─── Large coordinates (SGR advantage over legacy) ───

    it("parses SGR mouse with large coordinates (>223)", () => {
        const t = mouseToken(tokenize("\x1b[<0;500;300M"));
        expect(t.button).toBe("left");
        expect(t.action).toBe("press");
        expect(t.x).toBe(500);
        expect(t.y).toBe(300);
    });

    // ─── Edge cases ───

    it("parses SGR mouse at coordinate 1,1", () => {
        const t = mouseToken(tokenize("\x1b[<0;1;1M"));
        expect(t.x).toBe(1);
        expect(t.y).toBe(1);
    });

    it("preserves raw bytes in SGR token", () => {
        const raw = "\x1b[<0;10;20M";
        const t = mouseToken(tokenize(raw));
        expect(t.raw).toBe(raw);
    });
});

describe("tokenize.mouse — legacy X10 mode", () => {
    function legacyMouse(cb: number, x: number, y: number): string {
        return "\x1b[M" + String.fromCharCode(cb + 32, x + 32, y + 32);
    }

    it("parses legacy left click", () => {
        const t = mouseToken(tokenize(legacyMouse(0, 10, 20)));
        expect(t.button).toBe("left");
        expect(t.action).toBe("press");
        expect(t.x).toBe(10);
        expect(t.y).toBe(20);
    });

    it("parses legacy middle click", () => {
        const t = mouseToken(tokenize(legacyMouse(1, 5, 5)));
        expect(t.button).toBe("middle");
        expect(t.action).toBe("press");
    });

    it("parses legacy right click", () => {
        const t = mouseToken(tokenize(legacyMouse(2, 1, 1)));
        expect(t.button).toBe("right");
        expect(t.action).toBe("press");
    });

    it("parses legacy button release (cb & 3 === 3)", () => {
        // In legacy mode, release is encoded as button=3
        const t = mouseToken(tokenize(legacyMouse(3, 10, 20)));
        expect(t.button).toBe("none");
        expect(t.action).toBe("release");
    });

    it("parses legacy Ctrl+left click", () => {
        // Ctrl = bit 4 → 16
        const t = mouseToken(tokenize(legacyMouse(16, 10, 20)));
        expect(t.button).toBe("left");
        expect(t.action).toBe("press");
        expect(t.ctrlKey).toBe(true);
    });

    it("parses legacy scroll up", () => {
        // scroll up = 64
        const t = mouseToken(tokenize(legacyMouse(64, 10, 20)));
        expect(t.action).toBe("scroll-up");
    });

    it("parses legacy scroll down", () => {
        // scroll down = 65
        const t = mouseToken(tokenize(legacyMouse(65, 10, 20)));
        expect(t.action).toBe("scroll-down");
    });

    it("preserves raw bytes in legacy token", () => {
        const raw = legacyMouse(0, 10, 20);
        const t = mouseToken(tokenize(raw));
        expect(t.raw).toBe(raw);
    });
});

describe("tokenize.mouse — mixed input", () => {
    it("parses mouse event followed by keyboard input", () => {
        const input = "\x1b[<0;10;20M" + "a";
        const tokens = tokenize(input);
        expect(tokens).toHaveLength(2);
        expect(tokens[0].kind).toBe("mouse");
        expect(tokens[1].kind).toBe("char");
    });

    it("parses keyboard input followed by mouse event", () => {
        const input = "a" + "\x1b[<0;10;20M";
        const tokens = tokenize(input);
        expect(tokens).toHaveLength(2);
        expect(tokens[0].kind).toBe("char");
        expect(tokens[1].kind).toBe("mouse");
    });

    it("parses multiple mouse events in sequence", () => {
        const input = "\x1b[<0;10;20M" + "\x1b[<0;10;20m" + "\x1b[<0;11;20M";
        const tokens = tokenize(input);
        expect(tokens).toHaveLength(3);
        expect(tokens.every((t) => t.kind === "mouse")).toBe(true);
        const m0 = tokens[0] as MouseToken;
        const m1 = tokens[1] as MouseToken;
        const m2 = tokens[2] as MouseToken;
        expect(m0.action).toBe("press");
        expect(m1.action).toBe("release");
        expect(m2.action).toBe("press");
        expect(m2.x).toBe(11);
    });

    it("does not break existing CSI letter parsing", () => {
        // Arrow up should still work
        const tokens = tokenize("\x1b[A");
        expect(tokens).toHaveLength(1);
        expect(tokens[0].kind).toBe("csi-letter");
    });

    it("does not break existing CSI tilde parsing", () => {
        // Delete key
        const tokens = tokenize("\x1b[3~");
        expect(tokens).toHaveLength(1);
        expect(tokens[0].kind).toBe("csi-tilde");
    });

    it("mouse events interleaved with CSI keyboard sequences", () => {
        // left click, then arrow up, then right click release
        const input = "\x1b[<0;5;5M" + "\x1b[A" + "\x1b[<2;5;5m";
        const tokens = tokenize(input);
        expect(tokens).toHaveLength(3);
        expect(tokens[0].kind).toBe("mouse");
        expect(tokens[1].kind).toBe("csi-letter");
        expect(tokens[2].kind).toBe("mouse");
    });
});
