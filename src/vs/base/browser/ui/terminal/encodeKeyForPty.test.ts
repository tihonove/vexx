import { describe, expect, it } from "vitest";

import { TUIKeyboardEvent } from "../../../../../../tuidom/dom/events/tuiKeyboardEvent.ts";

import { encodeKeyForPty } from "./encodeKeyForPty.ts";

interface Mods {
    ctrlKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
}

function encode(key: string, mods: Mods = {}): string {
    return encodeKeyForPty(new TUIKeyboardEvent("keydown", { key, ...mods }));
}

describe("encodeKeyForPty", () => {
    it.each([
        ["a", "a"],
        ["Z", "Z"],
        ["1", "1"],
        [" ", " "],
    ])("passes printable %j through unchanged", (key, expected) => {
        expect(encode(key)).toBe(expected);
    });

    it.each([
        ["Enter", "\r"],
        ["Backspace", "\x7f"],
        ["Tab", "\t"],
        ["Escape", "\x1b"],
        ["Delete", "\x1b[3~"],
        ["Insert", "\x1b[2~"],
    ])("encodes control key %s", (key, expected) => {
        expect(encode(key)).toBe(expected);
    });

    it.each([
        ["ArrowUp", "\x1b[A"],
        ["ArrowDown", "\x1b[B"],
        ["ArrowRight", "\x1b[C"],
        ["ArrowLeft", "\x1b[D"],
    ])("encodes arrow %s", (key, expected) => {
        expect(encode(key)).toBe(expected);
    });

    it.each([
        ["Home", "\x1b[H"],
        ["End", "\x1b[F"],
        ["PageUp", "\x1b[5~"],
        ["PageDown", "\x1b[6~"],
    ])("encodes navigation key %s", (key, expected) => {
        expect(encode(key)).toBe(expected);
    });

    it.each([
        ["a", "\x01"],
        ["A", "\x01"], // uppercase → тот же control-байт
        ["c", "\x03"],
        ["z", "\x1a"],
    ])("encodes Ctrl+%s to a control byte", (key, expected) => {
        expect(encode(key, { ctrlKey: true })).toBe(expected);
    });

    it.each([
        [" ", "\x00"], // Ctrl+Space → NUL
        ["[", "\x1b"],
        ["\\", "\x1c"],
        ["]", "\x1d"],
    ])("encodes Ctrl+%j to its control symbol", (key, expected) => {
        expect(encode(key, { ctrlKey: true })).toBe(expected);
    });

    it("prefixes Alt-modified printables with ESC (meta byte)", () => {
        expect(encode("a", { altKey: true })).toBe("\x1ba");
    });

    it("prefixes Meta-modified printables with ESC (meta byte)", () => {
        expect(encode("a", { metaKey: true })).toBe("\x1ba");
    });

    it.each([
        ["F1", {}],
        ["F5", {}],
        ["Unknown", {}],
        ["1", { ctrlKey: true }], // Ctrl+цифра — не транслируем
    ])('returns "" for unhandled combo %s', (key, mods: Mods) => {
        expect(encode(key, mods)).toBe("");
    });
});
