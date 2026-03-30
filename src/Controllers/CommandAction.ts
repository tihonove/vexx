import type { ServiceAccessor } from "../Common/DiContainer.ts";
import type { IDisposable } from "../Common/Disposable.ts";

import type { CommandRegistry } from "./CommandRegistry.ts";
import type { KeybindingRegistry } from "./KeybindingRegistry.ts";

export interface CommandAction {
    readonly id: string;
    readonly title: string;
    readonly keybinding?: string;
    run(accessor: ServiceAccessor, ...args: unknown[]): unknown;
}

export function registerAction(
    commands: CommandRegistry,
    keybindings: KeybindingRegistry,
    accessor: ServiceAccessor,
    action: CommandAction,
): IDisposable {
    const disposables: IDisposable[] = [];

    disposables.push(commands.register(action.id, (...args: unknown[]) => action.run(accessor, ...args)));

    if (action.keybinding) {
        disposables.push(keybindings.register(action.keybinding, action.id));
    }

    return {
        dispose() {
            for (let i = disposables.length - 1; i >= 0; i--) {
                disposables[i].dispose();
            }
        },
    };
}
