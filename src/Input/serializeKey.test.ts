import { describe, expect, it } from "vitest";

import { parseInput } from "./parseInput.ts";
import { serializeKey } from "./serializeKey.ts";

describe("serializeKey", () => {
    // ─── Basic keys ───

    it("serializes a printable character", () => {
        expect(serializeKey("a")).toBe("a");
    });

    it("serializes Enter", () => {
        expect(serializeKey("Enter")).toBe("\x0d");
    });

    it("serializes Tab", () => {
        expect(serializeKey("Tab")).toBe("\x09");
    });

    it("serializes Backspace", () => {
        expect(serializeKey("Backspace")).toBe("\x7f");
    });

    it("serializes Escape", () => {
        expect(serializeKey("Escape")).toBe("\x1b");
    });

    it("serializes Space", () => {
        expect(serializeKey("Space")).toBe(" ");
    });

    // ─── Ctrl+letter ───

    it("serializes Ctrl+C", () => {
        expect(serializeKey("Ctrl+C")).toBe("\x03");
    });

    it("serializes Ctrl+A", () => {
        expect(serializeKey("Ctrl+A")).toBe("\x01");
    });

    it("serializes Ctrl+Z", () => {
        expect(serializeKey("Ctrl+Z")).toBe("\x1a");
    });

    // ─── Arrow keys ───

    it("serializes ArrowUp", () => {
        expect(serializeKey("ArrowUp")).toBe("\x1b[A");
    });

    it("serializes ArrowDown", () => {
        expect(serializeKey("ArrowDown")).toBe("\x1b[B");
    });

    it("serializes ArrowRight", () => {
        expect(serializeKey("ArrowRight")).toBe("\x1b[C");
    });

    it("serializes ArrowLeft", () => {
        expect(serializeKey("ArrowLeft")).toBe("\x1b[D");
    });

    // ─── Navigation keys ───

    it("serializes Home", () => {
        expect(serializeKey("Home")).toBe("\x1b[H");
    });

    it("serializes End", () => {
        expect(serializeKey("End")).toBe("\x1b[F");
    });

    it("serializes Insert", () => {
        expect(serializeKey("Insert")).toBe("\x1b[2~");
    });

    it("serializes Delete", () => {
        expect(serializeKey("Delete")).toBe("\x1b[3~");
    });

    it("serializes PageUp", () => {
        expect(serializeKey("PageUp")).toBe("\x1b[5~");
    });

    it("serializes PageDown", () => {
        expect(serializeKey("PageDown")).toBe("\x1b[6~");
    });

    // ─── F-keys ───

    it("serializes F1 (SS3)", () => {
        expect(serializeKey("F1")).toBe("\x1bOP");
    });

    it("serializes F4 (SS3)", () => {
        expect(serializeKey("F4")).toBe("\x1bOS");
    });

    it("serializes F5", () => {
        expect(serializeKey("F5")).toBe("\x1b[15~");
    });

    it("serializes F12", () => {
        expect(serializeKey("F12")).toBe("\x1b[24~");
    });

    // ─── Modifiers with special keys ───

    it("serializes Ctrl+ArrowUp", () => {
        expect(serializeKey("Ctrl+ArrowUp")).toBe("\x1b[1;5A");
    });

    it("serializes Shift+ArrowDown", () => {
        expect(serializeKey("Shift+ArrowDown")).toBe("\x1b[1;2B");
    });

    it("serializes Ctrl+Shift+ArrowLeft", () => {
        expect(serializeKey("Ctrl+Shift+ArrowLeft")).toBe("\x1b[1;6D");
    });

    it("serializes Ctrl+Delete", () => {
        expect(serializeKey("Ctrl+Delete")).toBe("\x1b[3;5~");
    });

    it("serializes Alt+a", () => {
        expect(serializeKey("Alt+a")).toBe("\x1ba");
    });

    // ─── Error handling ───

    it("throws on unknown key name", () => {
        expect(() => serializeKey("Ctrl+Shift+a")).toThrow("unknown key name");
    });

    // ─── Roundtrip with parseInput ───

    describe("roundtrip: serializeKey → parseInput", () => {
        const simpleKeys = [
            { dsl: "a", expectedKey: "a" },
            { dsl: "Z", expectedKey: "Z" },
            { dsl: "Enter", expectedKey: "Enter" },
            { dsl: "Tab", expectedKey: "Tab" },
            { dsl: "Backspace", expectedKey: "Backspace" },
            { dsl: "Escape", expectedKey: "Escape" },
            { dsl: "Space", expectedKey: " " },
            { dsl: "Ctrl+C", expectedKey: "c", ctrlKey: true, altKey: false },
            { dsl: "Ctrl+A", expectedKey: "a", ctrlKey: true },
            { dsl: "Ctrl+Z", expectedKey: "z", ctrlKey: true },
            { dsl: "ArrowUp", expectedKey: "ArrowUp" },
            { dsl: "ArrowDown", expectedKey: "ArrowDown" },
            { dsl: "ArrowLeft", expectedKey: "ArrowLeft" },
            { dsl: "ArrowRight", expectedKey: "ArrowRight" },
            { dsl: "Home", expectedKey: "Home" },
            { dsl: "End", expectedKey: "End" },
            { dsl: "Delete", expectedKey: "Delete" },
            { dsl: "Insert", expectedKey: "Insert" },
            { dsl: "PageUp", expectedKey: "PageUp" },
            { dsl: "PageDown", expectedKey: "PageDown" },
            { dsl: "F1", expectedKey: "F1" },
            { dsl: "F4", expectedKey: "F4" },
            { dsl: "F5", expectedKey: "F5" },
            { dsl: "F12", expectedKey: "F12" },
            { dsl: "Ctrl+ArrowUp", expectedKey: "ArrowUp", ctrlKey: true },
            { dsl: "Shift+ArrowDown", expectedKey: "ArrowDown", shiftKey: true },
            { dsl: "Ctrl+Delete", expectedKey: "Delete", ctrlKey: true, altKey: false },
        ];

        for (const { dsl, expectedKey, ctrlKey, shiftKey, altKey } of simpleKeys) {
            it(`roundtrip: '${dsl}' → raw → parseInput`, () => {
                const raw = serializeKey(dsl);
                const events = parseInput(raw);
                expect(events).toHaveLength(1);
                expect(events[0].key).toBe(expectedKey);
                if (ctrlKey) expect(events[0].ctrlKey).toBe(true);
                if (shiftKey) expect(events[0].shiftKey).toBe(true);
                if (altKey) expect(events[0].altKey).toBe(true);
                expect(events[0].type).toBe("keydown");
            });
        }
    });
});
