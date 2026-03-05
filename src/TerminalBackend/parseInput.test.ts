import { describe, it, expect } from "vitest";
import { parseInput } from "./parseInput.ts";

describe("parseInput", () => {
    it("parses a single printable character", () => {
        const events = parseInput("a");
        expect(events).toEqual([{ key: "a", raw: "a" }]);
    });

    it("parses multiple printable characters in one chunk", () => {
        const events = parseInput("hi");
        expect(events).toEqual([
            { key: "h", raw: "h" },
            { key: "i", raw: "i" },
        ]);
    });

    it("parses space", () => {
        const events = parseInput(" ");
        expect(events).toEqual([{ key: " ", raw: " " }]);
    });

    it("parses Enter (0x0d)", () => {
        const events = parseInput("\x0d");
        expect(events).toEqual([{ key: "Enter", raw: "\x0d" }]);
    });

    it("parses Tab (0x09)", () => {
        const events = parseInput("\x09");
        expect(events).toEqual([{ key: "Tab", raw: "\x09" }]);
    });

    it("parses Backspace (0x7f)", () => {
        const events = parseInput("\x7f");
        expect(events).toEqual([{ key: "Backspace", raw: "\x7f" }]);
    });

    it("parses Escape (0x1b)", () => {
        const events = parseInput("\x1b");
        expect(events).toEqual([{ key: "Escape", raw: "\x1b" }]);
    });

    it("parses Ctrl+C (0x03)", () => {
        const events = parseInput("\x03");
        expect(events).toEqual([{ key: "Ctrl+C", raw: "\x03" }]);
    });

    it("parses Ctrl+A (0x01)", () => {
        const events = parseInput("\x01");
        expect(events).toEqual([{ key: "Ctrl+A", raw: "\x01" }]);
    });

    it("parses Ctrl+Z (0x1a)", () => {
        const events = parseInput("\x1a");
        expect(events).toEqual([{ key: "Ctrl+Z", raw: "\x1a" }]);
    });

    it("parses mixed input: printable + control", () => {
        const events = parseInput("a\x03b");
        expect(events).toEqual([
            { key: "a", raw: "a" },
            { key: "Ctrl+C", raw: "\x03" },
            { key: "b", raw: "b" },
        ]);
    });

    it("returns empty array for empty input", () => {
        expect(parseInput("")).toEqual([]);
    });
});
