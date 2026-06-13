import { describe, expect, it } from "vitest";

import { ContextKeyService } from "./ContextKeyService.ts";
import { formatKeybinding, KeybindingRegistry, parseChord, parseKeybinding } from "./KeybindingRegistry.ts";

describe("KeybindingRegistry — getKeybindingForCommand", () => {
    it("returns undefined when the command has no binding", () => {
        const registry = new KeybindingRegistry();
        expect(registry.getKeybindingForCommand("missing")).toBeUndefined();
    });

    it("returns the single registered binding", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseKeybinding("ctrl+s"), "save");
        const chord = registry.getKeybindingForCommand("save");
        expect(chord && formatKeybinding(chord)).toBe("Ctrl+S");
    });

    it("returns a chord binding", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseChord("ctrl+k s"), "save");
        const chord = registry.getKeybindingForCommand("save");
        expect(chord && formatKeybinding(chord)).toBe("Ctrl+K S");
    });

    it("with multiple unconditional bindings returns the first registered", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseKeybinding("ctrl+s"), "save");
        registry.register(parseChord("ctrl+k s"), "save");
        const chord = registry.getKeybindingForCommand("save");
        expect(chord && formatKeybinding(chord)).toBe("Ctrl+S");
    });

    it("returns the binding whose when-condition matches the current context", () => {
        const registry = new KeybindingRegistry();
        const ctx = new ContextKeyService();
        registry.register(parseKeybinding("ctrl+s"), "go", "textInputFocus");
        registry.register(parseKeybinding("ctrl+l"), "go", "listFocus");

        ctx.set("listFocus", true);
        const chord = registry.getKeybindingForCommand("go", ctx);
        expect(chord && formatKeybinding(chord)).toBe("Ctrl+L");
    });

    it("falls back to the first registered binding when no when-condition matches", () => {
        const registry = new KeybindingRegistry();
        const ctx = new ContextKeyService();
        registry.register(parseKeybinding("ctrl+s"), "go", "textInputFocus");
        registry.register(parseKeybinding("ctrl+l"), "go", "listFocus");

        // Neither context key is set.
        const chord = registry.getKeybindingForCommand("go", ctx);
        expect(chord && formatKeybinding(chord)).toBe("Ctrl+S");
    });

    it("without a context service, returns the first registered binding", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseKeybinding("ctrl+s"), "go", "textInputFocus");
        registry.register(parseKeybinding("ctrl+l"), "go", "listFocus");

        const chord = registry.getKeybindingForCommand("go");
        expect(chord && formatKeybinding(chord)).toBe("Ctrl+S");
    });

    it("prefers an unconditional binding over a later when-conditioned one", () => {
        const registry = new KeybindingRegistry();
        const ctx = new ContextKeyService();
        registry.register(parseKeybinding("ctrl+s"), "go");
        registry.register(parseKeybinding("ctrl+l"), "go", "listFocus");

        ctx.set("listFocus", true);
        const chord = registry.getKeybindingForCommand("go", ctx);
        expect(chord && formatKeybinding(chord)).toBe("Ctrl+S");
    });
});
