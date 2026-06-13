import { describe, expect, it } from "vitest";

import type { KeyboardEventLike } from "./KeybindingRegistry.ts";
import { KeybindingRegistry, parseChord, parseKeybinding } from "./KeybindingRegistry.ts";

function resolve(registry: KeybindingRegistry, event: KeyboardEventLike): string | undefined {
    const res = registry.resolveKey(event);
    return res.kind === "command" ? res.commandId : undefined;
}

const KEY = (key: string, mods: Partial<KeyboardEventLike> = {}): KeyboardEventLike => ({
    key,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...mods,
});

describe("KeybindingRegistry.removeBindings", () => {
    it("removes all bindings for a command when no chord is given", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseKeybinding("ctrl+s"), "save");
        registry.register(parseChord("ctrl+k s"), "save");

        registry.removeBindings("save");

        expect(resolve(registry, KEY("s", { ctrlKey: true }))).toBeUndefined();
    });

    it("removes only the matching chord when one is given", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseKeybinding("ctrl+s"), "save");
        registry.register(parseKeybinding("ctrl+alt+s"), "save");

        registry.removeBindings("save", parseChord("ctrl+s"));

        expect(resolve(registry, KEY("s", { ctrlKey: true }))).toBeUndefined();
        expect(resolve(registry, KEY("s", { ctrlKey: true, altKey: true }))).toBe("save");
    });

    it("leaves other commands untouched", () => {
        const registry = new KeybindingRegistry();
        registry.register(parseKeybinding("ctrl+s"), "save");
        registry.register(parseKeybinding("ctrl+s"), "other");

        registry.removeBindings("save");

        // The remaining ctrl+s belongs to "other".
        expect(resolve(registry, KEY("s", { ctrlKey: true }))).toBe("other");
    });
});
