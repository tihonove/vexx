import { describe, it, expect } from "vitest";
import { KeyInputParser } from "./KeyInputParser.ts";
import type { KeyPressEvent } from "./KeyEvent.ts";

/** Helper: create expected event with defaults (default type is keydown) */
function ev(key: string, raw: string, overrides?: Partial<KeyPressEvent>): KeyPressEvent {
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

describe("KeyInputParser — browser-like event model", () => {
    // ─── Legacy terminal (no Kitty): keydown + keypress, no keyup ───

    describe("legacy terminal input", () => {
        it("printable char → keydown + keypress", () => {
            const parser = new KeyInputParser();
            const events = parser.parse("a");
            expect(events).toEqual([
                ev("a", "a", { code: "KeyA" }),
                ev("a", "a", { type: "keypress", code: "KeyA" }),
            ]);
        });

        it("multiple chars → keydown + keypress per char", () => {
            const parser = new KeyInputParser();
            const events = parser.parse("ab");
            expect(events).toHaveLength(4);
            expect(events[0]).toMatchObject({ type: "keydown", key: "a" });
            expect(events[1]).toMatchObject({ type: "keypress", key: "a" });
            expect(events[2]).toMatchObject({ type: "keydown", key: "b" });
            expect(events[3]).toMatchObject({ type: "keypress", key: "b" });
        });

        it("escape sequence → keydown + keypress", () => {
            const parser = new KeyInputParser();
            const events = parser.parse("\x1b[B");
            expect(events).toEqual([
                ev("ArrowDown", "\x1b[B"),
                ev("ArrowDown", "\x1b[B", { type: "keypress" }),
            ]);
        });

        it("Ctrl+C → keydown + keypress with ctrlKey", () => {
            const parser = new KeyInputParser();
            const events = parser.parse("\x03");
            expect(events).toEqual([
                ev("c", "\x03", { ctrlKey: true, code: "KeyC" }),
                ev("c", "\x03", { type: "keypress", ctrlKey: true, code: "KeyC" }),
            ]);
        });

        it("Enter → keydown + keypress", () => {
            const parser = new KeyInputParser();
            const events = parser.parse("\x0d");
            expect(events).toEqual([
                ev("Enter", "\x0d"),
                ev("Enter", "\x0d", { type: "keypress" }),
            ]);
        });

        it("Ctrl+ArrowUp → keydown + keypress with ctrlKey", () => {
            const parser = new KeyInputParser();
            const events = parser.parse("\x1b[1;5A");
            expect(events).toEqual([
                ev("ArrowUp", "\x1b[1;5A", { ctrlKey: true }),
                ev("ArrowUp", "\x1b[1;5A", { type: "keypress", ctrlKey: true }),
            ]);
        });

        it("Alt+a → keydown + keypress with altKey", () => {
            const parser = new KeyInputParser();
            const events = parser.parse("\x1ba");
            expect(events).toEqual([
                ev("a", "\x1ba", { altKey: true, code: "KeyA" }),
                ev("a", "\x1ba", { type: "keypress", altKey: true, code: "KeyA" }),
            ]);
        });
    });

    // ─── Kitty protocol: full keydown → keypress → keyup lifecycle ───

    describe("Kitty protocol — full lifecycle", () => {
        it("keydown → keydown + keypress", () => {
            const parser = new KeyInputParser();
            const events = parser.parse("\x1b[97;1:1u");
            expect(events).toEqual([
                ev("a", "\x1b[97;1:1u", { code: "KeyA" }),
                ev("a", "\x1b[97;1:1u", { type: "keypress", code: "KeyA" }),
            ]);
        });

        it("keyup after keydown → just keyup", () => {
            const parser = new KeyInputParser();
            parser.parse("\x1b[97;1:1u"); // keydown
            const events = parser.parse("\x1b[97;1:3u");
            expect(events).toEqual([
                ev("a", "\x1b[97;1:3u", { type: "keyup", code: "KeyA" }),
            ]);
        });

        it("press + release in one chunk → keydown + keypress + keyup", () => {
            const parser = new KeyInputParser();
            const press = "\x1b[B";
            const release = "\x1b[1;1:3B";
            const events = parser.parse(press + release);
            expect(events).toEqual([
                ev("ArrowDown", press),
                ev("ArrowDown", press, { type: "keypress" }),
                ev("ArrowDown", release, { type: "keyup" }),
            ]);
        });

        it("press + repeat + release → keydown + keypress + keypress(repeat) + keyup", () => {
            const parser = new KeyInputParser();

            const e1 = parser.parse("\x1b[97;1:1u"); // press
            expect(e1).toEqual([
                ev("a", "\x1b[97;1:1u", { code: "KeyA" }),
                ev("a", "\x1b[97;1:1u", { type: "keypress", code: "KeyA" }),
            ]);

            const e2 = parser.parse("\x1b[97;1:2u"); // repeat
            expect(e2).toEqual([
                ev("a", "\x1b[97;1:2u", { type: "keypress", code: "KeyA" }),
            ]);

            const e3 = parser.parse("\x1b[97;1:3u"); // release
            expect(e3).toEqual([
                ev("a", "\x1b[97;1:3u", { type: "keyup", code: "KeyA" }),
            ]);
        });

        it("multiple repeats produce multiple keypress events", () => {
            const parser = new KeyInputParser();
            parser.parse("\x1b[97;1:1u"); // press

            const e1 = parser.parse("\x1b[97;1:2u");
            const e2 = parser.parse("\x1b[97;1:2u");
            const e3 = parser.parse("\x1b[97;1:2u");

            expect(e1).toHaveLength(1);
            expect(e2).toHaveLength(1);
            expect(e3).toHaveLength(1);
            expect(e1[0].type).toBe("keypress");
            expect(e2[0].type).toBe("keypress");
            expect(e3[0].type).toBe("keypress");
        });
    });

    // ─── Modifier keys: keydown/keyup only, no keypress (browser model) ───

    describe("modifier-only keys", () => {
        it("Shift keydown → only keydown, no keypress", () => {
            const parser = new KeyInputParser();
            const leftShift = "\x1b[57441;1:1u";
            const events = parser.parse(leftShift);
            expect(events).toEqual([
                ev("Shift", leftShift, { type: "keydown", code: "ShiftLeft" }),
            ]);
        });

        it("Shift keyup → only keyup, no keypress", () => {
            const parser = new KeyInputParser();
            parser.parse("\x1b[57441;1:1u"); // keydown
            const events = parser.parse("\x1b[57441;1:3u");
            expect(events).toEqual([
                ev("Shift", "\x1b[57441;1:3u", { type: "keyup", code: "ShiftLeft" }),
            ]);
        });

        it("Meta keydown (PUA) → only keydown, no keypress", () => {
            const parser = new KeyInputParser();
            const leftSuper = String.fromCodePoint(57444);
            const events = parser.parse("\x1b" + leftSuper);
            expect(events).toEqual([
                ev("Meta", "\x1b" + leftSuper, { type: "keydown", code: "MetaLeft" }),
            ]);
        });

        it("orphaned modifier keyup → only keyup, no synthesis", () => {
            const parser = new KeyInputParser();
            const events = parser.parse("\x1b[57441;1:3u");
            expect(events).toEqual([
                ev("Shift", "\x1b[57441;1:3u", { type: "keyup", code: "ShiftLeft" }),
            ]);
        });

        it("double Shift tap → two keydown + two keyup (for double-tap detection)", () => {
            const parser = new KeyInputParser();

            const e1 = parser.parse("\x1b[57441;1:1u"); // keydown
            const e2 = parser.parse("\x1b[57441;1:3u"); // keyup
            const e3 = parser.parse("\x1b[57441;1:1u"); // keydown
            const e4 = parser.parse("\x1b[57441;1:3u"); // keyup

            expect(e1).toEqual([ev("Shift", "\x1b[57441;1:1u", { type: "keydown", code: "ShiftLeft" })]);
            expect(e2).toEqual([ev("Shift", "\x1b[57441;1:3u", { type: "keyup", code: "ShiftLeft" })]);
            expect(e3).toEqual([ev("Shift", "\x1b[57441;1:1u", { type: "keydown", code: "ShiftLeft" })]);
            expect(e4).toEqual([ev("Shift", "\x1b[57441;1:3u", { type: "keyup", code: "ShiftLeft" })]);
        });
    });

    // ─── Orphaned keyup: macOS Cmd+Arrow sends only release ───

    describe("orphaned keyup (macOS Cmd+Arrow)", () => {
        it("synthesizes keydown + keypress before orphaned keyup", () => {
            const parser = new KeyInputParser();

            // Meta keydown (modifier only)
            const leftSuper = String.fromCodePoint(57444);
            const e1 = parser.parse("\x1b" + leftSuper);
            expect(e1).toEqual([
                ev("Meta", "\x1b" + leftSuper, { type: "keydown", code: "MetaLeft" }),
            ]);

            // ArrowRight release (orphaned — never got a press) + Meta release
            const arrowRelease = "\x1b[1;9:3C";
            const superRelease = "\x1b[57444;1:3u";
            const e2 = parser.parse(arrowRelease + superRelease);

            expect(e2).toHaveLength(4);
            expect(e2[0]).toEqual(ev("ArrowRight", arrowRelease, { type: "keydown", metaKey: true }));
            expect(e2[1]).toEqual(ev("ArrowRight", arrowRelease, { type: "keypress", metaKey: true }));
            expect(e2[2]).toEqual(ev("ArrowRight", arrowRelease, { type: "keyup", metaKey: true }));
            expect(e2[3]).toEqual(ev("Meta", superRelease, { type: "keyup", code: "MetaLeft" }));
        });

        it("does NOT synthesize for orphaned modifier keyup", () => {
            const parser = new KeyInputParser();
            // Shift release without prior keydown — no synthesis, just keyup
            const events = parser.parse("\x1b[57441;1:3u");
            expect(events).toHaveLength(1);
            expect(events[0].type).toBe("keyup");
        });
    });

    // ─── State tracking across chunks ───

    describe("state tracking", () => {
        it("press → release → second orphaned release synthesizes full sequence", () => {
            const parser = new KeyInputParser();

            // First cycle: press + release — key tracked and removed
            parser.parse("\x1b[B"); // keydown ArrowDown
            parser.parse("\x1b[1;1:3B"); // keyup ArrowDown — removed from state

            // Orphaned release with Meta — should synthesize keydown + keypress + keyup
            const events = parser.parse("\x1b[1;9:3B");
            expect(events).toEqual([
                ev("ArrowDown", "\x1b[1;9:3B", { type: "keydown", metaKey: true }),
                ev("ArrowDown", "\x1b[1;9:3B", { type: "keypress", metaKey: true }),
                ev("ArrowDown", "\x1b[1;9:3B", { type: "keyup", metaKey: true }),
            ]);
        });

        it("interleaved keys tracked independently", () => {
            const parser = new KeyInputParser();

            // Press 'a' and 'b' without releasing
            parser.parse("\x1b[97;1:1u"); // a keydown
            parser.parse("\x1b[98;1:1u"); // b keydown

            // Release 'a' — should be normal keyup (was tracked)
            const e1 = parser.parse("\x1b[97;1:3u");
            expect(e1).toEqual([ev("a", "\x1b[97;1:3u", { type: "keyup", code: "KeyA" })]);

            // Release 'b' — also normal keyup
            const e2 = parser.parse("\x1b[98;1:3u");
            expect(e2).toEqual([ev("b", "\x1b[98;1:3u", { type: "keyup", code: "KeyB" })]);
        });
    });
});
