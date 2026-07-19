import { MenuId } from "../Menus/MenuId.ts";
import { FindServiceDIToken } from "../Services/FindService.ts";
import { parseKeybinding } from "../Services/KeybindingRegistry.ts";

import type { CommandAction } from "./CommandAction.ts";

// Тонкие экшены find-виджета поверх FindService (этап 10: run-обработчики живут
// в самих экшенах, как у quick-open). nextMatch/previousMatch/closeFindWidget
// регистрируются ПОСЛЕ builtin editor-экшенов (хвост builtinActions в
// WorkbenchComponent): резолвер кейбиндов берёт последний зарегистрированный с
// проходящим `when`, и биндинги `findWidgetVisible` должны победить.

export const findAction: CommandAction = {
    id: "actions.find",
    title: "Find",
    menus: [{ menuId: MenuId.MenubarEditMenu, group: "3_find", order: 10 }],
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
    shortTitle: "Find Next",
    menus: [{ menuId: MenuId.MenubarEditMenu, group: "3_find", order: 20 }],
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
    shortTitle: "Find Previous",
    menus: [{ menuId: MenuId.MenubarEditMenu, group: "3_find", order: 30 }],
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
