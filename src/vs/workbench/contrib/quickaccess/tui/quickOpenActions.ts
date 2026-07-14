import type { CommandAction } from "../../../../platform/commands/common/commandAction.ts";
import { registerAction } from "../../../../platform/commands/common/commandAction.ts";
import type { IDisposable } from "../../../../base/common/lifecycle.ts";
import type { CommandRegistry } from "../../../../platform/commands/common/commands.ts";
import type { ServiceAccessor } from "../../../../platform/instantiation/common/instantiation.ts";
import type { KeybindingRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import type { QuickOpenController } from "./quickOpenController.ts";
import { parseChord, parseKeybinding } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";

export const quickOpenAction: CommandAction = {
    id: "workbench.action.quickOpen",
    title: "Go to File...",
    keybinding: parseKeybinding("ctrl+p"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const gotoLineAction: CommandAction = {
    id: "workbench.action.gotoLine",
    title: "Go to Line/Column...",
    keybinding: parseKeybinding("ctrl+g"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const showCommandsAction: CommandAction = {
    id: "workbench.action.showCommands",
    title: "Show All Commands",
    keybinding: parseKeybinding("ctrl+shift+p"),
    // Ctrl+Shift+letter is unreliable on legacy terminals — add the VS Code chord fallback.
    keybindings: [{ keys: parseChord("ctrl+k ctrl+p"), when: "tier == 'legacy'" }],
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

/**
 * Регистрирует обработчики quick-access команд (Go to File / Command Palette /
 * Go to Line) поверх деклараций выше — реальные хендлеры открывают
 * соответствующий режим QuickOpenController.
 */
export function registerQuickAccessActions(deps: {
    commands: CommandRegistry;
    keybindings: KeybindingRegistry;
    accessor: ServiceAccessor;
    quickOpen: QuickOpenController;
}): IDisposable[] {
    const { commands, keybindings, accessor } = deps;
    return [
        registerAction(commands, keybindings, accessor, {
            ...quickOpenAction,
            run: () => {
                deps.quickOpen.open("files");
            },
        }),
        registerAction(commands, keybindings, accessor, {
            ...showCommandsAction,
            run: () => {
                deps.quickOpen.open("commands");
            },
        }),
        registerAction(commands, keybindings, accessor, {
            ...gotoLineAction,
            run: () => {
                deps.quickOpen.open("line");
            },
        }),
    ];
}
