import { describe, it, expect } from "vitest";
import { parseInput } from "./parseInput.ts";
import type { KeyPressEvent } from "./KeyEvent.ts";

/** Helper: create expected event with defaults */
function kp(key: string, raw: string, overrides?: Partial<KeyPressEvent>): KeyPressEvent {
    return {
        type: "keypress",
        key,
        code: overrides?.code ?? key,
        ctrlKey: overrides?.ctrlKey ?? false,
        shiftKey: overrides?.shiftKey ?? false,
        altKey: overrides?.altKey ?? false,
        metaKey: overrides?.metaKey ?? false,
        raw,
    };
}

describe("parseInput", () => {
    // ─── Printable characters ───

    it("parses a single printable character", () => {
        const events = parseInput("a");
        expect(events).toEqual([kp("a", "a", { code: "KeyA" })]);
    });

    it("parses multiple printable characters in one chunk", () => {
        const events = parseInput("hi");
        expect(events).toEqual([kp("h", "h", { code: "KeyH" }), kp("i", "i", { code: "KeyI" })]);
    });

    it("parses space", () => {
        const events = parseInput(" ");
        expect(events).toEqual([kp(" ", " ", { code: "Space" })]);
    });

    it("parses uppercase letter", () => {
        const events = parseInput("A");
        expect(events).toEqual([kp("A", "A", { code: "KeyA" })]);
    });

    it("parses digit", () => {
        const events = parseInput("5");
        expect(events).toEqual([kp("5", "5", { code: "Digit5" })]);
    });

    // ─── Special keys ───

    it("parses Enter (0x0d)", () => {
        const events = parseInput("\x0d");
        expect(events).toEqual([kp("Enter", "\x0d")]);
    });

    it("parses Tab (0x09)", () => {
        const events = parseInput("\x09");
        expect(events).toEqual([kp("Tab", "\x09")]);
    });

    it("parses Backspace (0x7f)", () => {
        const events = parseInput("\x7f");
        expect(events).toEqual([kp("Backspace", "\x7f")]);
    });

    it("parses Escape (0x1b standalone)", () => {
        const events = parseInput("\x1b");
        expect(events).toEqual([kp("Escape", "\x1b")]);
    });

    // ─── Ctrl+letter ───

    it("parses Ctrl+C (0x03)", () => {
        const events = parseInput("\x03");
        expect(events).toEqual([kp("c", "\x03", { ctrlKey: true, code: "KeyC" })]);
    });

    it("parses Ctrl+A (0x01)", () => {
        const events = parseInput("\x01");
        expect(events).toEqual([kp("a", "\x01", { ctrlKey: true, code: "KeyA" })]);
    });

    it("parses Ctrl+Z (0x1a)", () => {
        const events = parseInput("\x1a");
        expect(events).toEqual([kp("z", "\x1a", { ctrlKey: true, code: "KeyZ" })]);
    });

    it("parses Ctrl+Space (0x00)", () => {
        const events = parseInput("\x00");
        expect(events).toEqual([kp(" ", "\x00", { ctrlKey: true, code: "Space" })]);
    });

    // ─── Mixed input ───

    it("parses mixed input: printable + control", () => {
        const events = parseInput("a\x03b");
        expect(events).toEqual([
            kp("a", "a", { code: "KeyA" }),
            kp("c", "\x03", { ctrlKey: true, code: "KeyC" }),
            kp("b", "b", { code: "KeyB" }),
        ]);
    });

    it("returns empty array for empty input", () => {
        expect(parseInput("")).toEqual([]);
    });

    // ─── CSI sequences: arrow keys ───

    it("parses ArrowUp (\\x1b[A)", () => {
        const events = parseInput("\x1b[A");
        expect(events).toEqual([kp("ArrowUp", "\x1b[A")]);
    });

    it("parses ArrowDown (\\x1b[B)", () => {
        const events = parseInput("\x1b[B");
        expect(events).toEqual([kp("ArrowDown", "\x1b[B")]);
    });

    it("parses ArrowRight (\\x1b[C)", () => {
        const events = parseInput("\x1b[C");
        expect(events).toEqual([kp("ArrowRight", "\x1b[C")]);
    });

    it("parses ArrowLeft (\\x1b[D)", () => {
        const events = parseInput("\x1b[D");
        expect(events).toEqual([kp("ArrowLeft", "\x1b[D")]);
    });

    // ─── CSI sequences: navigation ───

    it("parses Home (\\x1b[H)", () => {
        const events = parseInput("\x1b[H");
        expect(events).toEqual([kp("Home", "\x1b[H")]);
    });

    it("parses End (\\x1b[F)", () => {
        const events = parseInput("\x1b[F");
        expect(events).toEqual([kp("End", "\x1b[F")]);
    });

    it("parses Insert (\\x1b[2~)", () => {
        const events = parseInput("\x1b[2~");
        expect(events).toEqual([kp("Insert", "\x1b[2~")]);
    });

    it("parses Delete (\\x1b[3~)", () => {
        const events = parseInput("\x1b[3~");
        expect(events).toEqual([kp("Delete", "\x1b[3~")]);
    });

    it("parses PageUp (\\x1b[5~)", () => {
        const events = parseInput("\x1b[5~");
        expect(events).toEqual([kp("PageUp", "\x1b[5~")]);
    });

    it("parses PageDown (\\x1b[6~)", () => {
        const events = parseInput("\x1b[6~");
        expect(events).toEqual([kp("PageDown", "\x1b[6~")]);
    });

    // ─── CSI sequences: F-keys ───

    it("parses F5 (\\x1b[15~)", () => {
        const events = parseInput("\x1b[15~");
        expect(events).toEqual([kp("F5", "\x1b[15~")]);
    });

    it("parses F6 (\\x1b[17~)", () => {
        const events = parseInput("\x1b[17~");
        expect(events).toEqual([kp("F6", "\x1b[17~")]);
    });

    it("parses F12 (\\x1b[24~)", () => {
        const events = parseInput("\x1b[24~");
        expect(events).toEqual([kp("F12", "\x1b[24~")]);
    });

    // ─── SS3 sequences: F1–F4 ───

    it("parses F1 (\\x1bOP)", () => {
        const events = parseInput("\x1bOP");
        expect(events).toEqual([kp("F1", "\x1bOP")]);
    });

    it("parses F2 (\\x1bOQ)", () => {
        const events = parseInput("\x1bOQ");
        expect(events).toEqual([kp("F2", "\x1bOQ")]);
    });

    it("parses F3 (\\x1bOR)", () => {
        const events = parseInput("\x1bOR");
        expect(events).toEqual([kp("F3", "\x1bOR")]);
    });

    it("parses F4 (\\x1bOS)", () => {
        const events = parseInput("\x1bOS");
        expect(events).toEqual([kp("F4", "\x1bOS")]);
    });

    // ─── CSI with modifiers ───

    it("parses Ctrl+ArrowUp (\\x1b[1;5A)", () => {
        const events = parseInput("\x1b[1;5A");
        expect(events).toEqual([kp("ArrowUp", "\x1b[1;5A", { ctrlKey: true })]);
    });

    it("parses Shift+ArrowDown (\\x1b[1;2B)", () => {
        const events = parseInput("\x1b[1;2B");
        expect(events).toEqual([kp("ArrowDown", "\x1b[1;2B", { shiftKey: true })]);
    });

    it("parses Alt+ArrowRight (\\x1b[1;3C)", () => {
        const events = parseInput("\x1b[1;3C");
        expect(events).toEqual([kp("ArrowRight", "\x1b[1;3C", { altKey: true })]);
    });

    it("parses Ctrl+Shift+ArrowLeft (\\x1b[1;6D)", () => {
        const events = parseInput("\x1b[1;6D");
        expect(events).toEqual([kp("ArrowLeft", "\x1b[1;6D", { ctrlKey: true, shiftKey: true })]);
    });

    it("parses Ctrl+Delete (\\x1b[3;5~)", () => {
        const events = parseInput("\x1b[3;5~");
        expect(events).toEqual([kp("Delete", "\x1b[3;5~", { ctrlKey: true })]);
    });

    it("parses Shift+F5 (\\x1b[15;2~)", () => {
        const events = parseInput("\x1b[15;2~");
        expect(events).toEqual([kp("F5", "\x1b[15;2~", { shiftKey: true })]);
    });

    // ─── Kitty Keyboard Protocol (CSI u) ───

    it("parses Kitty CSI u: 'a' (\\x1b[97u)", () => {
        const events = parseInput("\x1b[97u");
        expect(events).toEqual([kp("a", "\x1b[97u", { code: "KeyA" })]);
    });

    it("parses Kitty CSI u: Ctrl+a (\\x1b[97;5u)", () => {
        const events = parseInput("\x1b[97;5u");
        expect(events).toEqual([kp("a", "\x1b[97;5u", { ctrlKey: true, code: "KeyA" })]);
    });

    it("parses Kitty CSI u: Shift+Alt+a (\\x1b[97;4u)", () => {
        const events = parseInput("\x1b[97;4u");
        expect(events).toEqual([kp("a", "\x1b[97;4u", { shiftKey: true, altKey: true, code: "KeyA" })]);
    });

    // ─── Alt+key via ESC prefix ───

    it("parses Alt+a (\\x1ba)", () => {
        const events = parseInput("\x1ba");
        expect(events).toEqual([kp("a", "\x1ba", { altKey: true, code: "KeyA" })]);
    });

    it("parses Alt+Enter (\\x1b\\x0d)", () => {
        const events = parseInput("\x1b\x0d");
        expect(events).toEqual([kp("Enter", "\x1b\x0d", { altKey: true })]);
    });

    it("parses Alt+Backspace (\\x1b\\x7f)", () => {
        const events = parseInput("\x1b\x7f");
        expect(events).toEqual([kp("Backspace", "\x1b\x7f", { altKey: true })]);
    });

    it("parses Alt+Ctrl+C (\\x1b\\x03)", () => {
        const events = parseInput("\x1b\x03");
        expect(events).toEqual([kp("c", "\x1b\x03", { altKey: true, ctrlKey: true, code: "KeyC" })]);
    });

    // ─── Edge cases ───

    it("handles multiple CSI sequences in one chunk", () => {
        const events = parseInput("\x1b[A\x1b[B");
        expect(events).toHaveLength(2);
        expect(events[0].key).toBe("ArrowUp");
        expect(events[1].key).toBe("ArrowDown");
    });

    it("handles CSI sequence followed by printable", () => {
        const events = parseInput("\x1b[Aa");
        expect(events).toHaveLength(2);
        expect(events[0].key).toBe("ArrowUp");
        expect(events[1].key).toBe("a");
    });

    it("handles unknown CSI sequence gracefully", () => {
        // \x1b[99~ — unknown tilde key
        const events = parseInput("\x1b[99~");
        // Falls back to Escape + rest parsed as printable chars
        expect(events[0].key).toBe("Escape");
    });

    it("all events have type 'keypress'", () => {
        const events = parseInput("abc\x03\x1b[A\x1b\x0d");
        for (const event of events) {
            expect(event.type).toBe("keypress");
        }
    });
});
