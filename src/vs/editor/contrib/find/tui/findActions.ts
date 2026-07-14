import type { CommandAction } from "../../../../platform/commands/common/commandAction.ts";
import { registerAction } from "../../../../platform/commands/common/commandAction.ts";
import type { IDisposable } from "../../../../base/common/lifecycle.ts";
import type { CommandRegistry } from "../../../../platform/commands/common/commands.ts";
import type { ServiceAccessor } from "../../../../platform/instantiation/common/instantiation.ts";
import type { KeybindingRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import type { FindController } from "./findController.ts";
import { parseKeybinding } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";

// All four run() bodies are placeholders — AppController installs the real
// handlers (wired to FindController) at runtime, like the quick-open actions.

export const findAction: CommandAction = {
    id: "actions.find",
    title: "Find",
    keybinding: parseKeybinding("ctrl+f"),
    // Reachable from the editor, and while the widget is open (to refocus the input).
    when: "textInputFocus || findWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const nextMatchAction: CommandAction = {
    id: "editor.action.nextMatchFindAction",
    title: "Find: Next Match",
    keybinding: parseKeybinding("enter"),
    keybindings: [parseKeybinding("f3")],
    when: "findWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const previousMatchAction: CommandAction = {
    id: "editor.action.previousMatchFindAction",
    title: "Find: Previous Match",
    keybinding: parseKeybinding("shift+enter"),
    keybindings: [parseKeybinding("shift+f3")],
    when: "findWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const closeFindWidgetAction: CommandAction = {
    id: "closeFindWidget",
    title: "Find: Close",
    keybinding: parseKeybinding("escape"),
    when: "findWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

/** Регистрирует обработчики find-команд поверх деклараций выше. */
export function registerFindActions(deps: {
    commands: CommandRegistry;
    keybindings: KeybindingRegistry;
    accessor: ServiceAccessor;
    findController: FindController;
}): IDisposable[] {
    const { commands, keybindings, accessor, findController } = deps;
    return [
        registerAction(commands, keybindings, accessor, {
            ...findAction,
            run: () => {
                findController.open();
            },
        }),
        registerAction(commands, keybindings, accessor, {
            ...nextMatchAction,
            run: () => {
                findController.next();
            },
        }),
        registerAction(commands, keybindings, accessor, {
            ...previousMatchAction,
            run: () => {
                findController.prev();
            },
        }),
        registerAction(commands, keybindings, accessor, {
            ...closeFindWidgetAction,
            run: () => {
                findController.close();
            },
        }),
    ];
}
