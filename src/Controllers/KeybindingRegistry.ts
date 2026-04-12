import { token } from "../Common/DiContainer.ts";
import type { IDisposable } from "../Common/Disposable.ts";

import type { ContextKeyService } from "./ContextKeyService.ts";

export const KeybindingRegistryDIToken = token<KeybindingRegistry>("KeybindingRegistry");

export interface KeyboardEventLike {
    readonly key: string;
    readonly ctrlKey: boolean;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
    readonly metaKey: boolean;
}

export interface Keybinding {
    key: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
}

interface KeybindingEntry {
    binding: Keybinding;
    commandId: string;
    when?: string;
}

const specialKeyMap: Record<string, string> = {
    enter: "Enter",
    escape: "Escape",
    tab: "Tab",
    backspace: "Backspace",
    space: " ",
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    home: "Home",
    end: "End",
    pageup: "PageUp",
    pagedown: "PageDown",
    delete: "Delete",
    insert: "Insert",
    f1: "F1",
    f2: "F2",
    f3: "F3",
    f4: "F4",
    f5: "F5",
    f6: "F6",
    f7: "F7",
    f8: "F8",
    f9: "F9",
    f10: "F10",
    f11: "F11",
    f12: "F12",
};

const modifierNames = new Set(["ctrl", "shift", "alt", "meta"]);

export function parseKeybinding(spec: string): Keybinding {
    const parts = spec.toLowerCase().split("+");
    let ctrlKey = false;
    let shiftKey = false;
    let altKey = false;
    let metaKey = false;
    let rawKey = "";

    for (const part of parts) {
        if (part === "ctrl") ctrlKey = true;
        else if (part === "shift") shiftKey = true;
        else if (part === "alt") altKey = true;
        else if (part === "meta") metaKey = true;
        else rawKey = part;
    }

    const key = specialKeyMap[rawKey] ?? rawKey;

    return { key, ctrlKey, shiftKey, altKey, metaKey };
}

function matchesBinding(event: KeyboardEventLike, binding: Keybinding): boolean {
    return (
        event.key.toLowerCase() === binding.key.toLowerCase() &&
        event.ctrlKey === binding.ctrlKey &&
        event.shiftKey === binding.shiftKey &&
        event.altKey === binding.altKey &&
        event.metaKey === binding.metaKey
    );
}

export class KeybindingRegistry implements IDisposable {
    private entries: KeybindingEntry[] = [];

    public register(binding: Keybinding, commandId: string, when?: string): IDisposable {
        const entry: KeybindingEntry = {
            binding,
            commandId,
            when,
        };
        this.entries.push(entry);
        return {
            dispose: () => {
                const index = this.entries.indexOf(entry);
                if (index !== -1) this.entries.splice(index, 1);
            },
        };
    }

    public resolve(event: KeyboardEventLike, contextKeys?: ContextKeyService): string | undefined {
        for (let i = this.entries.length - 1; i >= 0; i--) {
            const entry = this.entries[i];
            if (matchesBinding(event, entry.binding)) {
                if (entry.when && contextKeys) {
                    if (!contextKeys.evaluate(entry.when)) continue;
                } else if (entry.when) {
                    continue;
                }
                return entry.commandId;
            }
        }
        return undefined;
    }

    public dispose(): void {
        this.entries.length = 0;
    }
}
