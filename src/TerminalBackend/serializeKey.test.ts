import { describe, it, expect } from "vitest";
import { serializeKey } from "./serializeKey.ts";
import { parseInput } from "./parseInput.ts";

describe("serializeKey", () => {
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

    it("serializes Ctrl+C", () => {
        expect(serializeKey("Ctrl+C")).toBe("\x03");
    });

    it("serializes Ctrl+A", () => {
        expect(serializeKey("Ctrl+A")).toBe("\x01");
    });

    it("serializes Ctrl+Z", () => {
        expect(serializeKey("Ctrl+Z")).toBe("\x1a");
    });

    it("throws on unknown key name", () => {
        expect(() => serializeKey("F1")).toThrow('unknown key name "F1"');
    });

    describe("roundtrip with parseInput", () => {
        const keys = ["a", "Z", " ", "Enter", "Tab", "Backspace", "Escape", "Ctrl+C", "Ctrl+A", "Ctrl+Z"];

        for (const key of keys) {
            it(`roundtrip: serializeKey('${key}') -> parseInput -> '${key}'`, () => {
                const raw = serializeKey(key === " " ? "Space" : key);
                const events = parseInput(raw);
                expect(events).toHaveLength(1);
                expect(events[0].key).toBe(key);
            });
        }
    });
});
