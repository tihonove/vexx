import * as fs from "node:fs";
import * as path from "node:path";

import type { CommandAction } from "../../../../platform/commands/common/commandAction.ts";
import { registerAction } from "../../../../platform/commands/common/commandAction.ts";
import type { IDisposable } from "../../../../base/common/lifecycle.ts";
import type { CommandRegistry } from "../../../../platform/commands/common/commands.ts";
import type { ServiceAccessor } from "../../../../platform/instantiation/common/instantiation.ts";
import type { KeybindingRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import { parseChord, parseKeybinding } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";

/**
 * Open the user settings.json (VS Code `workbench.action.openSettings`). Vexx has
 * no settings UI, so the command opens the JSON file directly. Default binding
 * matches VS Code (Ctrl+,). The real handler is installed by `AppController`;
 * this only declares id / title / binding.
 */
export const openSettingsAction: CommandAction = {
    id: "workbench.action.openSettings",
    title: "Preferences: Open User Settings",
    keybinding: parseKeybinding("ctrl+,"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime (needs the resolved settings path) */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};

/**
 * Open the user keybindings.json (VS Code `workbench.action.openGlobalKeybindings`).
 * As with settings, we open the JSON file directly. Default chord matches VS Code
 * (Ctrl+K Ctrl+S). The real handler is installed by `AppController`.
 */
export const openKeybindingsAction: CommandAction = {
    id: "workbench.action.openGlobalKeybindings",
    title: "Preferences: Open Keyboard Shortcuts",
    keybinding: parseChord("ctrl+k ctrl+s"),
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime (needs the resolved keybindings path) */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};

/**
 * Регистрирует обработчики Open Settings / Open Keyboard Shortcuts.
 * Открывает user-config файл (settings.json / keybindings.json) вкладкой
 * редактора. Путь резолвится на bootstrap'е; в тестах/демо он null — тогда
 * команда no-op. На свежей установке файла может не быть: сеем скелет
 * (каталог + минимальное содержимое), чтобы редактор открыл реальный файл
 * и последующий Ctrl+S не упал с ENOENT — как в VS Code.
 */
export function registerPreferencesActions(deps: {
    commands: CommandRegistry;
    keybindings: KeybindingRegistry;
    accessor: ServiceAccessor;
    settingsResource: string | null;
    keybindingsResource: string | null;
    openFile(absolutePath: string): void;
}): IDisposable[] {
    const { commands, keybindings, accessor } = deps;
    const openUserConfigFile = (resource: string | null, kind: "settings" | "keybindings"): void => {
        if (resource === null) return;
        if (!fs.existsSync(resource)) {
            const skeleton = kind === "settings" ? "{}\n" : "[]\n";
            fs.mkdirSync(path.dirname(resource), { recursive: true });
            fs.writeFileSync(resource, skeleton, "utf-8");
        }
        deps.openFile(resource);
    };
    return [
        registerAction(commands, keybindings, accessor, {
            ...openSettingsAction,
            run: () => {
                openUserConfigFile(deps.settingsResource, "settings");
            },
        }),
        registerAction(commands, keybindings, accessor, {
            ...openKeybindingsAction,
            run: () => {
                openUserConfigFile(deps.keybindingsResource, "keybindings");
            },
        }),
    ];
}
