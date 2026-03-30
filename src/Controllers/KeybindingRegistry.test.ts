import { describe, expect, it } from "vitest";

import type { KeyboardEventLike } from "./KeybindingRegistry.ts";
import { KeybindingRegistry, parseKeybinding } from "./KeybindingRegistry.ts";

function makeEvent(overrides: Partial<KeyboardEventLike> & { key: string }): KeyboardEventLike {
    return {
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        ...overrides,
    };
}

describe("parseKeybinding", () => {
    it("parses a single letter key", () => {
        expect(parseKeybinding("a")).toEqual({
            key: "a",
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            metaKey: false,
        });
    });

    it("parses ctrl+key", () => {
        const result = parseKeybinding("ctrl+s");
        expect(result.ctrlKey).toBe(true);
        expect(result.key).toBe("s");
    });

    it("parses ctrl+shift+key", () => {
        const result = parseKeybinding("ctrl+shift+p");
        expect(result.ctrlKey).toBe(true);
        expect(result.shiftKey).toBe(true);
        expect(result.key).toBe("p");
    });

    it("parses alt+key", () => {
        const result = parseKeybinding("alt+z");
        expect(result.altKey).toBe(true);
        expect(result.key).toBe("z");
    });

    it("parses meta+key", () => {
        const result = parseKeybinding("meta+x");
        expect(result.metaKey).toBe(true);
        expect(result.key).toBe("x");
    });

    it("normalizes enter", () => {
        expect(parseKeybinding("enter").key).toBe("Enter");
    });

    it("normalizes escape", () => {
        expect(parseKeybinding("escape").key).toBe("Escape");
    });

    it("normalizes tab", () => {
        expect(parseKeybinding("tab").key).toBe("Tab");
    });

    it("normalizes arrow keys", () => {
        expect(parseKeybinding("up").key).toBe("ArrowUp");
        expect(parseKeybinding("down").key).toBe("ArrowDown");
        expect(parseKeybinding("left").key).toBe("ArrowLeft");
        expect(parseKeybinding("right").key).toBe("ArrowRight");
    });

    it("normalizes function keys", () => {
        expect(parseKeybinding("f1").key).toBe("F1");
        expect(parseKeybinding("f12").key).toBe("F12");
    });

    it("normalizes home/end/pageup/pagedown/delete/insert", () => {
        expect(parseKeybinding("home").key).toBe("Home");
        expect(parseKeybinding("end").key).toBe("End");
        expect(parseKeybinding("pageup").key).toBe("PageUp");
        expect(parseKeybinding("pagedown").key).toBe("PageDown");
        expect(parseKeybinding("delete").key).toBe("Delete");
        expect(parseKeybinding("insert").key).toBe("Insert");
    });

    it("normalizes space", () => {
        expect(parseKeybinding("space").key).toBe(" ");
    });

    it("normalizes backspace", () => {
        expect(parseKeybinding("backspace").key).toBe("Backspace");
    });

    it("is case-insensitive for spec", () => {
        const result = parseKeybinding("Ctrl+S");
        expect(result.ctrlKey).toBe(true);
        expect(result.key).toBe("s");
    });
});

describe("KeybindingRegistry", () => {
    it("resolves a matching keybinding", () => {
        const registry = new KeybindingRegistry();
        registry.register("ctrl+s", "workbench.action.files.save");

        const result = registry.resolve(makeEvent({ key: "s", ctrlKey: true }));

        expect(result).toBe("workbench.action.files.save");
    });

    it("returns undefined when no match", () => {
        const registry = new KeybindingRegistry();
        registry.register("ctrl+s", "workbench.action.files.save");

        const result = registry.resolve(makeEvent({ key: "q", ctrlKey: true }));

        expect(result).toBeUndefined();
    });

    it("does not match when modifiers differ", () => {
        const registry = new KeybindingRegistry();
        registry.register("ctrl+s", "save");

        expect(registry.resolve(makeEvent({ key: "s" }))).toBeUndefined();
        expect(registry.resolve(makeEvent({ key: "s", ctrlKey: true, shiftKey: true }))).toBeUndefined();
    });

    it("last registered wins on conflict", () => {
        const registry = new KeybindingRegistry();
        registry.register("ctrl+s", "first");
        registry.register("ctrl+s", "second");

        const result = registry.resolve(makeEvent({ key: "s", ctrlKey: true }));

        expect(result).toBe("second");
    });

    it("matches key case-insensitively", () => {
        const registry = new KeybindingRegistry();
        registry.register("ctrl+s", "save");

        const result = registry.resolve(makeEvent({ key: "S", ctrlKey: true }));

        expect(result).toBe("save");
    });

    it("resolves special keys", () => {
        const registry = new KeybindingRegistry();
        registry.register("ctrl+enter", "exec");

        const result = registry.resolve(makeEvent({ key: "Enter", ctrlKey: true }));

        expect(result).toBe("exec");
    });

    it("unregisters via returned disposable", () => {
        const registry = new KeybindingRegistry();
        const disposable = registry.register("ctrl+s", "save");

        disposable.dispose();

        expect(registry.resolve(makeEvent({ key: "s", ctrlKey: true }))).toBeUndefined();
    });

    it("dispose() clears all bindings", () => {
        const registry = new KeybindingRegistry();
        registry.register("ctrl+s", "save");
        registry.register("ctrl+q", "quit");

        registry.dispose();

        expect(registry.resolve(makeEvent({ key: "s", ctrlKey: true }))).toBeUndefined();
        expect(registry.resolve(makeEvent({ key: "q", ctrlKey: true }))).toBeUndefined();
    });
});
