import type { ServiceAccessor } from "../Common/DiContainer.ts";
import type { IDisposable } from "../Common/Disposable.ts";

import type { CommandRegistry } from "./CommandRegistry.ts";
import type { Keybinding, KeybindingChord, KeybindingRegistry } from "./KeybindingRegistry.ts";

export interface CommandAction {
    readonly id: string;
    readonly title: string;
    /** Primary binding. A single combination or a chord (e.g. parseChord("ctrl+k ctrl+s")). */
    readonly keybinding?: Keybinding | KeybindingChord;
    /** Alternative bindings, each a single combination or a chord. */
    readonly keybindings?: (Keybinding | KeybindingChord)[];
    readonly when?: string;
    run(accessor: ServiceAccessor, ...args: unknown[]): unknown;
}

export function registerAction(
    commands: CommandRegistry,
    keybindings: KeybindingRegistry,
    accessor: ServiceAccessor,
    action: CommandAction,
): IDisposable {
    const disposables: IDisposable[] = [];

    disposables.push(commands.register(action.id, (...args: unknown[]) => action.run(accessor, ...args), action.title));

    const allBindings: (Keybinding | KeybindingChord)[] = [];
    if (action.keybinding) {
        allBindings.push(action.keybinding);
    }
    if (action.keybindings) {
        allBindings.push(...action.keybindings);
    }

    for (const binding of allBindings) {
        disposables.push(keybindings.register(binding, action.id, action.when));
    }

    return {
        dispose() {
            for (let i = disposables.length - 1; i >= 0; i--) {
                disposables[i].dispose();
            }
        },
    };
}
