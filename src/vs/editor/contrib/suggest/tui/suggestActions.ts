import type { CommandAction } from "../../../../platform/commands/common/commandAction.ts";
import { registerAction } from "../../../../platform/commands/common/commandAction.ts";
import type { IDisposable } from "../../../../base/common/lifecycle.ts";
import type { CommandRegistry } from "../../../../platform/commands/common/commands.ts";
import type { ServiceAccessor } from "../../../../platform/instantiation/common/instantiation.ts";
import type { KeybindingRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import type { CompletionController } from "./completionController.ts";
import { parseKeybinding } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";

// All run() bodies are placeholders — AppController installs the real handlers
// (wired to CompletionController) at runtime, like the find/quick-open actions.
// Every action is gated by `suggestWidgetVisible`; registered AFTER the builtin
// editor actions so it wins over cursorDown/indentLines while the popup is open
// (KeybindingRegistry.resolveKey: last-registered with passing `when` wins).

export const selectNextSuggestionAction: CommandAction = {
    id: "selectNextSuggestion",
    title: "Suggest: Select Next",
    keybinding: parseKeybinding("down"),
    when: "suggestWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const selectPrevSuggestionAction: CommandAction = {
    id: "selectPrevSuggestion",
    title: "Suggest: Select Previous",
    keybinding: parseKeybinding("up"),
    when: "suggestWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const selectNextPageSuggestionAction: CommandAction = {
    id: "selectNextPageSuggestion",
    title: "Suggest: Select Next Page",
    keybinding: parseKeybinding("pagedown"),
    when: "suggestWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const selectPrevPageSuggestionAction: CommandAction = {
    id: "selectPrevPageSuggestion",
    title: "Suggest: Select Previous Page",
    keybinding: parseKeybinding("pageup"),
    when: "suggestWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const acceptSelectedSuggestionAction: CommandAction = {
    id: "acceptSelectedSuggestion",
    title: "Suggest: Accept Selected",
    keybinding: parseKeybinding("enter"),
    keybindings: [parseKeybinding("tab")],
    when: "suggestWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

export const hideSuggestWidgetAction: CommandAction = {
    id: "hideSuggestWidget",
    title: "Suggest: Close",
    keybinding: parseKeybinding("escape"),
    when: "suggestWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController
    },
    /* v8 ignore stop */
};

/**
 * Регистрирует обработчики suggest-команд. Навигация/accept/dismiss попапа
 * должны регистрироваться ПОСЛЕ builtinActions-цикла воркбенча, чтобы биндинги
 * с when=suggestWidgetVisible выигрывали у editor cursorDown/indentLines, пока
 * попап открыт; triggerSuggest переопределяет плейсхолдер из того же цикла
 * (Map.set заменяет обработчик, не дублируя ctrl+space-биндинг).
 */
export function registerSuggestActions(deps: {
    commands: CommandRegistry;
    keybindings: KeybindingRegistry;
    accessor: ServiceAccessor;
    completionController: CompletionController;
}): IDisposable[] {
    const { commands, keybindings, accessor, completionController } = deps;
    return [
        commands.register(
            "editor.action.triggerSuggest",
            () => {
                void completionController.trigger();
            },
            "Trigger Suggest",
        ),
        registerAction(commands, keybindings, accessor, {
            ...selectNextSuggestionAction,
            run: () => {
                completionController.selectNext();
            },
        }),
        registerAction(commands, keybindings, accessor, {
            ...selectPrevSuggestionAction,
            run: () => {
                completionController.selectPrevious();
            },
        }),
        registerAction(commands, keybindings, accessor, {
            ...selectNextPageSuggestionAction,
            run: () => {
                completionController.selectNextPage();
            },
        }),
        registerAction(commands, keybindings, accessor, {
            ...selectPrevPageSuggestionAction,
            run: () => {
                completionController.selectPreviousPage();
            },
        }),
        registerAction(commands, keybindings, accessor, {
            ...acceptSelectedSuggestionAction,
            run: () => {
                completionController.acceptSelected();
            },
        }),
        registerAction(commands, keybindings, accessor, {
            ...hideSuggestWidgetAction,
            run: () => {
                completionController.hide();
            },
        }),
    ];
}
