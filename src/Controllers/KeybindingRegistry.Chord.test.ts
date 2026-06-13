import { describe, expect, it } from "vitest";

import { ContextKeyService } from "./ContextKeyService.ts";
import type { KeyboardEventLike } from "./KeybindingRegistry.ts";
import { formatKeybinding, KeybindingRegistry, parseChord, parseKeybinding } from "./KeybindingRegistry.ts";

function makeEvent(overrides: Partial<KeyboardEventLike> & { key: string }): KeyboardEventLike {
    return {
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        ...overrides,
    };
}

describe("parseChord", () => {
    it("parses a single combination as a one-part chord", () => {
        expect(parseChord("ctrl+s")).toEqual([parseKeybinding("ctrl+s")]);
    });

    it("parses a two-part chord", () => {
        expect(parseChord("ctrl+k ctrl+s")).toEqual([parseKeybinding("ctrl+k"), parseKeybinding("ctrl+s")]);
    });

    it("ignores surrounding and repeated whitespace", () => {
        expect(parseChord("  ctrl+k    s  ")).toEqual([parseKeybinding("ctrl+k"), parseKeybinding("s")]);
    });
});

describe("formatKeybinding", () => {
    it("formats a single letter", () => {
        expect(formatKeybinding(parseChord("a"))).toBe("A");
    });

    it("formats modifiers in canonical order", () => {
        expect(formatKeybinding(parseChord("shift+ctrl+p"))).toBe("Ctrl+Shift+P");
    });

    it("formats special keys with friendly names", () => {
        expect(formatKeybinding(parseChord("ctrl+pagedown"))).toBe("Ctrl+PageDown");
        expect(formatKeybinding(parseChord("left"))).toBe("Left");
        expect(formatKeybinding(parseChord("space"))).toBe("Space");
        expect(formatKeybinding(parseChord("ctrl+enter"))).toBe("Ctrl+Enter");
    });

    it("formats a chord as space-separated parts", () => {
        expect(formatKeybinding(parseChord("ctrl+k ctrl+s"))).toBe("Ctrl+K Ctrl+S");
    });
});

describe("KeybindingRegistry — chords", () => {
    it("returns chord on first part, command on completing second part", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseChord("ctrl+k s"), "save");

        const first = registry.resolveKey(makeEvent({ key: "k", ctrlKey: true }));
        expect(first.kind).toBe("chord");
        if (first.kind === "chord") {
            expect(formatKeybinding(first.chord)).toBe("Ctrl+K");
        }

        const second = registry.resolveKey(makeEvent({ key: "s" }));
        expect(second).toEqual({ kind: "command", commandId: "save" });
    });

    it("cancels the chord and returns none on a non-matching second part", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseChord("ctrl+k s"), "save");

        registry.resolveKey(makeEvent({ key: "k", ctrlKey: true }));
        const second = registry.resolveKey(makeEvent({ key: "x" }));
        expect(second).toEqual({ kind: "none" });

        // Pending state was reset: pressing the first part again starts fresh.
        const again = registry.resolveKey(makeEvent({ key: "k", ctrlKey: true }));
        expect(again.kind).toBe("chord");
    });

    it("breaking a chord consumes the key without firing its standalone binding", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseChord("ctrl+k s"), "save-chord");
        registry.register(parseKeybinding("ctrl+s"), "save-direct");

        // Enter chord mode with Ctrl+K…
        expect(registry.resolveKey(makeEvent({ key: "k", ctrlKey: true })).kind).toBe("chord");
        // …then press Ctrl+S (not the chord's "s"): the chord breaks and the key
        // is consumed (matching VS Code) — the standalone Ctrl+S does NOT fire.
        expect(registry.resolveKey(makeEvent({ key: "s", ctrlKey: true }))).toEqual({ kind: "none" });
        expect(registry.pendingLength).toBe(0);
    });

    it("breaking a chord with an unbound key resolves to none and clears pending", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseChord("ctrl+k s"), "save");

        registry.resolveKey(makeEvent({ key: "k", ctrlKey: true }));
        expect(registry.resolveKey(makeEvent({ key: "z", ctrlKey: true }))).toEqual({ kind: "none" });
        expect(registry.pendingLength).toBe(0);
    });

    it("resetPending() cancels an in-progress chord", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseChord("ctrl+k s"), "save");

        registry.resolveKey(makeEvent({ key: "k", ctrlKey: true }));
        registry.resetPending();

        // 's' alone is not bound, so after reset it resolves to nothing.
        expect(registry.resolveKey(makeEvent({ key: "s" }))).toEqual({ kind: "none" });
    });

    it("a single-key binding wins immediately over a longer chord sharing its prefix", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseKeybinding("ctrl+k"), "single");
        registry.register(parseChord("ctrl+k s"), "chord");

        // Complete match at depth 1 takes precedence — no waiting.
        expect(registry.resolveKey(makeEvent({ key: "k", ctrlKey: true }))).toEqual({
            kind: "command",
            commandId: "single",
        });
    });

    it("supports three-part chords", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseChord("ctrl+k ctrl+x s"), "deep");

        expect(registry.resolveKey(makeEvent({ key: "k", ctrlKey: true })).kind).toBe("chord");
        expect(registry.resolveKey(makeEvent({ key: "x", ctrlKey: true })).kind).toBe("chord");
        expect(registry.resolveKey(makeEvent({ key: "s" }))).toEqual({ kind: "command", commandId: "deep" });
    });

    it("only advances a chord whose when-condition passes", () => {
        const registry = new KeybindingRegistry();
        const ctx = new ContextKeyService();
        registry.register(parseChord("ctrl+k s"), "save", "textInputFocus");

        // Context not satisfied → first part does not even start the chord.
        expect(registry.resolveKey(makeEvent({ key: "k", ctrlKey: true }), ctx)).toEqual({ kind: "none" });

        ctx.set("textInputFocus", true);
        expect(registry.resolveKey(makeEvent({ key: "k", ctrlKey: true }), ctx).kind).toBe("chord");
        expect(registry.resolveKey(makeEvent({ key: "s" }), ctx)).toEqual({ kind: "command", commandId: "save" });
    });

    it("ordinary single combinations still resolve in one step", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseKeybinding("ctrl+s"), "save");

        expect(registry.resolveKey(makeEvent({ key: "s", ctrlKey: true }))).toEqual({
            kind: "command",
            commandId: "save",
        });
    });
});
