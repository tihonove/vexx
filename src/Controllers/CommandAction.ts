import type { ServiceAccessor } from "../Common/DiContainer.ts";
import type { IDisposable } from "../Common/Disposable.ts";

import type { CommandRegistry } from "./CommandRegistry.ts";
import type { Keybinding, KeybindingChord, KeybindingRegistry } from "./KeybindingRegistry.ts";

/**
 * A binding plus an optional `when` that narrows JUST this binding — used for
 * environment-conditional defaults (tier / mode / capability / OS). The per-binding
 * `when` is AND-ed with the action-wide `when`.
 *
 * Example: bind Ctrl+Shift+Right only where the terminal can disambiguate it:
 *   { keys: parseKeybinding("ctrl+shift+right"), when: "tier == 'kitty' || tier == 'csi-u'" }
 */
export interface ConditionalKeybinding {
    readonly keys: Keybinding | KeybindingChord;
    readonly when?: string;
}

export type KeybindingEntry = Keybinding | KeybindingChord | ConditionalKeybinding;

export interface CommandAction {
    readonly id: string;
    readonly title: string;
    /** Primary binding. A combination, a chord, or a conditional `{ keys, when }`. */
    readonly keybinding?: KeybindingEntry;
    /** Alternative bindings, each a combination, chord, or conditional `{ keys, when }`. */
    readonly keybindings?: KeybindingEntry[];
    /** Action-wide when, AND-ed with any per-binding when. */
    readonly when?: string;
    run(accessor: ServiceAccessor, ...args: unknown[]): unknown;
}

function isConditionalKeybinding(entry: KeybindingEntry): entry is ConditionalKeybinding {
    return !Array.isArray(entry) && "keys" in entry;
}

/** AND-combines the action-wide `when` with a per-binding `when` (either may be absent). */
export function combineWhen(actionWhen?: string, bindingWhen?: string): string | undefined {
    if (actionWhen && bindingWhen) return `(${actionWhen}) && (${bindingWhen})`;
    return actionWhen ?? bindingWhen;
}

export function registerAction(
    commands: CommandRegistry,
    keybindings: KeybindingRegistry,
    accessor: ServiceAccessor,
    action: CommandAction,
): IDisposable {
    const disposables: IDisposable[] = [];

    disposables.push(commands.register(action.id, (...args: unknown[]) => action.run(accessor, ...args), action.title));

    const allBindings: KeybindingEntry[] = [];
    if (action.keybinding) {
        allBindings.push(action.keybinding);
    }
    if (action.keybindings) {
        allBindings.push(...action.keybindings);
    }

    for (const entry of allBindings) {
        const { keys, when } = isConditionalKeybinding(entry)
            ? { keys: entry.keys, when: entry.when }
            : { keys: entry, when: undefined };
        disposables.push(keybindings.register(keys, action.id, combineWhen(action.when, when)));
    }

    return {
        dispose() {
            for (let i = disposables.length - 1; i >= 0; i--) {
                disposables[i].dispose();
            }
        },
    };
}
