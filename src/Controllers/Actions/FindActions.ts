import type { CommandAction } from "../../Workbench/Actions/CommandAction.ts";
import { parseKeybinding } from "../../Workbench/Services/KeybindingRegistry.ts";

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
