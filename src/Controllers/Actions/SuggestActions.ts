import type { CommandAction } from "../CommandAction.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

// ─── Suggest widget navigation ──────────────────────────────────────────────
//
// Editor-focus completion (как в VS Code): пока попап видим, редактор сохраняет
// фокус и набор уходит в буфер. Перехватываются лишь навигационные клавиши —
// они гейтятся контекст-ключом `suggestWidgetVisible`, поэтому вне попапа те же
// клавиши достаются редактору как обычно (↑/↓ двигают каретку, Enter/Tab правят
// буфер, Escape свободен).
//
// Реальные обработчики устанавливает `AppController` (делегирует в
// `CompletionController`) — здесь только плейсхолдер `run` и дефолтные
// кейбинды, как у `editor.action.triggerSuggest`. Идентификаторы команд и
// биндинги повторяют VS Code.

/** Идентификаторы suggest-навигации — по ним `AppController` перехватывает клавиши в capture-фазе. */
export const SUGGEST_NAV_COMMAND_IDS = [
    "selectNextSuggestion",
    "selectPrevSuggestion",
    "acceptSelectedSuggestion",
    "hideSuggestWidget",
] as const;

/** Выбрать следующий элемент попапа (↓). */
export const selectNextSuggestionAction: CommandAction = {
    id: "selectNextSuggestion",
    title: "Select Next Suggestion",
    keybinding: parseKeybinding("down"),
    when: "suggestWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};

/** Выбрать предыдущий элемент попапа (↑). */
export const selectPrevSuggestionAction: CommandAction = {
    id: "selectPrevSuggestion",
    title: "Select Previous Suggestion",
    keybinding: parseKeybinding("up"),
    when: "suggestWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};

/** Принять выбранный элемент (Enter / Tab). */
export const acceptSelectedSuggestionAction: CommandAction = {
    id: "acceptSelectedSuggestion",
    title: "Accept Selected Suggestion",
    keybinding: parseKeybinding("enter"),
    keybindings: [parseKeybinding("tab")],
    when: "suggestWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};

/** Закрыть попап без вставки (Escape). */
export const hideSuggestWidgetAction: CommandAction = {
    id: "hideSuggestWidget",
    title: "Hide Suggest Widget",
    keybinding: parseKeybinding("escape"),
    when: "suggestWidgetVisible",
    /* v8 ignore start -- placeholder; AppController installs the real handler at runtime */
    run() {
        // Overridden in AppController.
    },
    /* v8 ignore stop */
};

/** Все suggest-навигационные экшены в порядке регистрации. */
export const suggestActions: readonly CommandAction[] = [
    selectNextSuggestionAction,
    selectPrevSuggestionAction,
    acceptSelectedSuggestionAction,
    hideSuggestWidgetAction,
];
