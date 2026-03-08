import { describe, it, expect } from "vitest";
import { KeyInputParser } from "./KeyInputParser.ts";
import type { KeyPressEvent } from "./KeyEvent.ts";

/** Helper: create expected event with defaults */
function kp(key: string, raw: string, overrides?: Partial<KeyPressEvent>): KeyPressEvent {
    return {
        type: overrides?.type ?? "keydown",
        key,
        code: overrides?.code ?? key,
        ctrlKey: overrides?.ctrlKey ?? false,
        shiftKey: overrides?.shiftKey ?? false,
        altKey: overrides?.altKey ?? false,
        metaKey: overrides?.metaKey ?? false,
        raw,
    };
}

describe("KeyInputParser", () => {
    // ─── Normal key: keydown → keypress → keyup ───

    it("emits keydown + keypress for a normal key press, then keyup", () => {
        const parser = new KeyInputParser();

        // Chunk 1: legacy ArrowDown press → keydown + synthesized keypress
        const events1 = parser.parse("\x1b[B");
        expect(events1).toEqual([
            kp("ArrowDown", "\x1b[B"),
            kp("ArrowDown", "\x1b[B", { type: "keypress" }),
        ]);

        // Chunk 2: ArrowDown release → just keyup (no extra synthesis)
        const events2 = parser.parse("\x1b[1;1:3B");
        expect(events2).toEqual([kp("ArrowDown", "\x1b[1;1:3B", { type: "keyup" })]);
    });

    it("emits keydown + keypress for explicit Kitty keydown, then keyup", () => {
        const parser = new KeyInputParser();

        // Chunk 1: 'a' keydown → keydown + synthesized keypress
        const events1 = parser.parse("\x1b[97;1:1u");
        expect(events1).toEqual([
            kp("a", "\x1b[97;1:1u", { code: "KeyA" }),
            kp("a", "\x1b[97;1:1u", { type: "keypress", code: "KeyA" }),
        ]);

        // Chunk 2: 'a' keyup
        const events2 = parser.parse("\x1b[97;1:3u");
        expect(events2).toEqual([kp("a", "\x1b[97;1:3u", { type: "keyup", code: "KeyA" })]);
    });

    // ─── Cmd+Arrow: only release, no press → synthesize full sequence ───

    it("synthesizes keydown + keypress for orphaned keyup (Cmd+Right)", () => {
        const parser = new KeyInputParser();

        // Chunk 1: LEFT_SUPER keydown (ESC + PUA) — modifier, no keypress
        const leftSuper = String.fromCodePoint(57444);
        const events1 = parser.parse("\x1b" + leftSuper);
        expect(events1).toEqual([
            kp("Meta", "\x1b" + leftSuper, { type: "keydown", code: "MetaLeft" }),
        ]);

        // Chunk 2: ArrowRight release + LEFT_SUPER release
        const arrowRelease = "\x1b[1;9:3C";
        const superRelease = "\x1b[57444;1:3u";
        const events2 = parser.parse(arrowRelease + superRelease);

        expect(events2).toHaveLength(4);
        // Synthesized keydown for ArrowRight
        expect(events2[0]).toEqual(
            kp("ArrowRight", arrowRelease, { type: "keydown", metaKey: true }),
        );
        // Synthesized keypress for ArrowRight
        expect(events2[1]).toEqual(
            kp("ArrowRight", arrowRelease, { type: "keypress", metaKey: true }),
        );
        // Original keyup
        expect(events2[2]).toEqual(
            kp("ArrowRight", arrowRelease, { type: "keyup", metaKey: true }),
        );
        // Modifier keyup (no synthesis for modifiers)
        expect(events2[3]).toEqual(
            kp("Meta", superRelease, { type: "keyup", code: "MetaLeft" }),
        );
    });

    // ─── Modifier keyup: never synthesize ───

    it("does not synthesize keypress for modifier keyup", () => {
        const parser = new KeyInputParser();

        // Just a Shift release — no preceding press
        const events = parser.parse("\x1b[57441;1:3u");
        expect(events).toEqual([
            kp("Shift", "\x1b[57441;1:3u", { type: "keyup", code: "ShiftLeft" }),
        ]);
    });

    it("does not synthesize keypress for modifier keydown", () => {
        const parser = new KeyInputParser();

        const leftSuper = String.fromCodePoint(57444);
        const events = parser.parse("\x1b" + leftSuper);
        // Only keydown, no keypress for modifier
        expect(events).toEqual([
            kp("Meta", "\x1b" + leftSuper, { type: "keydown", code: "MetaLeft" }),
        ]);
    });

    // ─── Press + release in same chunk ───

    it("emits keydown + keypress + keyup when press + release come in one chunk", () => {
        const parser = new KeyInputParser();

        const press = "\x1b[B";
        const release = "\x1b[1;1:3B";
        const events = parser.parse(press + release);
        expect(events).toEqual([
            kp("ArrowDown", press),
            kp("ArrowDown", press, { type: "keypress" }),
            kp("ArrowDown", release, { type: "keyup" }),
        ]);
    });

    // ─── Key repeat does not break state ───

    it("handles press + repeat + release across chunks", () => {
        const parser = new KeyInputParser();

        // Press → keydown + keypress
        const events1 = parser.parse("\x1b[97;1:1u");
        expect(events1).toEqual([
            kp("a", "\x1b[97;1:1u", { code: "KeyA" }),
            kp("a", "\x1b[97;1:1u", { type: "keypress", code: "KeyA" }),
        ]);

        // Repeat → keypress (pass through as-is)
        const events2 = parser.parse("\x1b[97;1:2u");
        expect(events2).toEqual([kp("a", "\x1b[97;1:2u", { type: "keypress", code: "KeyA" })]);

        // Release — no extra synthesis, press was tracked
        const events3 = parser.parse("\x1b[97;1:3u");
        expect(events3).toEqual([kp("a", "\x1b[97;1:3u", { type: "keyup", code: "KeyA" })]);
    });

    // ─── State resets after keyup ───

    it("tracks state correctly across multiple press/release cycles", () => {
        const parser = new KeyInputParser();

        // First cycle: press + release
        parser.parse("\x1b[B"); // press
        parser.parse("\x1b[1;1:3B"); // release — key removed from state

        // Second orphaned release — should synthesize full sequence
        const events = parser.parse("\x1b[1;9:3B");
        expect(events).toEqual([
            kp("ArrowDown", "\x1b[1;9:3B", { type: "keydown", metaKey: true }),
            kp("ArrowDown", "\x1b[1;9:3B", { type: "keypress", metaKey: true }),
            kp("ArrowDown", "\x1b[1;9:3B", { type: "keyup", metaKey: true }),
        ]);
    });

    // ─── Legacy input → keydown + keypress per char ───

    it("emits keydown + keypress for each printable character", () => {
        const parser = new KeyInputParser();

        const events = parser.parse("ab");
        expect(events).toHaveLength(4);
        expect(events[0]).toMatchObject({ type: "keydown", key: "a" });
        expect(events[1]).toMatchObject({ type: "keypress", key: "a" });
        expect(events[2]).toMatchObject({ type: "keydown", key: "b" });
        expect(events[3]).toMatchObject({ type: "keypress", key: "b" });
    });
});
