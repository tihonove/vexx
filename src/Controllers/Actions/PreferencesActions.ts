import type { CommandAction } from "../CommandAction.ts";
import { parseChord, parseKeybinding } from "../KeybindingRegistry.ts";

/**
 * Команды открытия пользовательского `settings.json` / `keybindings.json` в редакторе —
 * аналог VS Code `workbench.action.openSettingsJson` / `workbench.action.openGlobalKeybindingsFile`.
 *
 * У Vexx пока нет графических редакторов Settings / Keyboard Shortcuts, поэтому основные
 * бинды VS Code (`Ctrl+,` для настроек, `Ctrl+K Ctrl+S` для биндов) ведут прямо на JSON-файлы
 * (как VS Code при `workbench.settings.editor: "json"`). Когда появятся UI-редакторы —
 * это отдельная подфича, а бинды переедут на них.
 *
 * Настоящие обработчики ставит `AppController` (нужны `IUserDataPaths` и группа редакторов),
 * здесь — только декларация id/title/keybinding.
 */

export const openSettingsJsonAction: CommandAction = {
    id: "workbench.action.openSettingsJson",
    title: "Preferences: Open User Settings (JSON)",
    keybinding: parseKeybinding("ctrl+,"),
    /* v8 ignore start -- placeholder; AppController installs the real handler */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};

export const openKeybindingsJsonAction: CommandAction = {
    id: "workbench.action.openGlobalKeybindingsFile",
    title: "Preferences: Open Keyboard Shortcuts (JSON)",
    keybinding: parseChord("ctrl+k ctrl+s"),
    /* v8 ignore start -- placeholder; AppController installs the real handler */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};
