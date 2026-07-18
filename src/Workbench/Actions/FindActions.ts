import { FindServiceDIToken } from "../Services/FindService.ts";
import { parseKeybinding } from "../Services/KeybindingRegistry.ts";
import type { CommandAction } from "./CommandAction.ts";

// Тонкие экшены find-виджета поверх FindService (этап 10: run-обработчики живут
// в самих экшенах, как у quick-open). nextMatch/previousMatch/closeFindWidget
// регистрируются ПОСЛЕ builtin editor-экшенов (хвост builtinActions в
// AppController): резолвер кейбиндов берёт последний зарегистрированный с
// проходящим `when`, и биндинги `findWidgetVisible` должны победить.

export const findAction: CommandAction = {
    id: "actions.find",
    title: "Find",
    keybinding: parseKeybinding("ctrl+f"),
    // Reachable from the editor, and while the widget is open (to refocus the input).
    when: "textInputFocus || findWidgetVisible",
    run(accessor) {
        accessor.get(FindServiceDIToken).open();
    },
};

export const nextMatchAction: CommandAction = {
    id: "editor.action.nextMatchFindAction",
    title: "Find: Next Match",
    keybinding: parseKeybinding("enter"),
    keybindings: [parseKeybinding("f3")],
    when: "findWidgetVisible",
    run(accessor) {
        accessor.get(FindServiceDIToken).next();
    },
};

export const previousMatchAction: CommandAction = {
    id: "editor.action.previousMatchFindAction",
    title: "Find: Previous Match",
    keybinding: parseKeybinding("shift+enter"),
    keybindings: [parseKeybinding("shift+f3")],
    when: "findWidgetVisible",
    run(accessor) {
        accessor.get(FindServiceDIToken).prev();
    },
};

export const closeFindWidgetAction: CommandAction = {
    id: "closeFindWidget",
    title: "Find: Close",
    keybinding: parseKeybinding("escape"),
    when: "findWidgetVisible",
    run(accessor) {
        accessor.get(FindServiceDIToken).close();
    },
};
