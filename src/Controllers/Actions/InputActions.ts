import type { CommandAction } from "../CommandAction.ts";
import { ClipboardDIToken } from "../CoreTokens.ts";
import { InputWidgetControllerDIToken } from "../InputWidgetController.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

// ─── Cursor Movement ─────────────────────────────────────────

export const inputCursorLeftAction: CommandAction = {
    id: "input.cursorLeft",
    title: "Input: Cursor Left",
    keybinding: parseKeybinding("left"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).cursorLeft();
    },
};

export const inputCursorRightAction: CommandAction = {
    id: "input.cursorRight",
    title: "Input: Cursor Right",
    keybinding: parseKeybinding("right"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).cursorRight();
    },
};

export const inputCursorHomeAction: CommandAction = {
    id: "input.cursorHome",
    title: "Input: Cursor Home",
    keybinding: parseKeybinding("home"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).cursorHome();
    },
};

export const inputCursorEndAction: CommandAction = {
    id: "input.cursorEnd",
    title: "Input: Cursor End",
    keybinding: parseKeybinding("end"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).cursorEnd();
    },
};

export const inputCursorWordLeftAction: CommandAction = {
    id: "input.cursorWordLeft",
    title: "Input: Cursor Word Left",
    keybinding: parseKeybinding("ctrl+left"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).cursorWordLeft();
    },
};

export const inputCursorWordRightAction: CommandAction = {
    id: "input.cursorWordRight",
    title: "Input: Cursor Word Right",
    keybinding: parseKeybinding("ctrl+right"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).cursorWordRight();
    },
};

// ─── Editing ─────────────────────────────────────────────────

export const inputDeleteLeftAction: CommandAction = {
    id: "input.deleteLeft",
    title: "Input: Delete Left",
    keybinding: parseKeybinding("backspace"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).deleteLeft();
    },
};

export const inputDeleteRightAction: CommandAction = {
    id: "input.deleteRight",
    title: "Input: Delete Right",
    keybinding: parseKeybinding("delete"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).deleteRight();
    },
};

export const inputDeleteWordLeftAction: CommandAction = {
    id: "input.deleteWordLeft",
    title: "Input: Delete Word Left",
    keybinding: parseKeybinding("ctrl+backspace"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).deleteWordLeft();
    },
};

export const inputDeleteWordRightAction: CommandAction = {
    id: "input.deleteWordRight",
    title: "Input: Delete Word Right",
    keybinding: parseKeybinding("ctrl+delete"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).deleteWordRight();
    },
};

// ─── Selection ───────────────────────────────────────────────

export const inputSelectLeftAction: CommandAction = {
    id: "input.selectLeft",
    title: "Input: Select Left",
    keybinding: parseKeybinding("shift+left"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).selectLeft();
    },
};

export const inputSelectRightAction: CommandAction = {
    id: "input.selectRight",
    title: "Input: Select Right",
    keybinding: parseKeybinding("shift+right"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).selectRight();
    },
};

export const inputSelectToHomeAction: CommandAction = {
    id: "input.selectToHome",
    title: "Input: Select to Home",
    keybinding: parseKeybinding("shift+home"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).selectToHome();
    },
};

export const inputSelectToEndAction: CommandAction = {
    id: "input.selectToEnd",
    title: "Input: Select to End",
    keybinding: parseKeybinding("shift+end"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).selectToEnd();
    },
};

export const inputSelectWordLeftAction: CommandAction = {
    id: "input.selectWordLeft",
    title: "Input: Select Word Left",
    keybinding: parseKeybinding("ctrl+shift+left"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).selectWordLeft();
    },
};

export const inputSelectWordRightAction: CommandAction = {
    id: "input.selectWordRight",
    title: "Input: Select Word Right",
    keybinding: parseKeybinding("ctrl+shift+right"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).selectWordRight();
    },
};

export const inputSelectAllAction: CommandAction = {
    id: "input.selectAll",
    title: "Input: Select All",
    keybinding: parseKeybinding("ctrl+a"),
    when: "inputWidgetFocus",
    run(accessor) {
        accessor.get(InputWidgetControllerDIToken).selectAll();
    },
};

// ─── Clipboard ───────────────────────────────────────────────

export const inputCopyAction: CommandAction = {
    id: "input.copy",
    title: "Input: Copy",
    keybinding: parseKeybinding("ctrl+c"),
    when: "inputWidgetFocus",
    async run(accessor) {
        await accessor.get(InputWidgetControllerDIToken).copy(accessor.get(ClipboardDIToken));
    },
};

export const inputCutAction: CommandAction = {
    id: "input.cut",
    title: "Input: Cut",
    keybinding: parseKeybinding("ctrl+x"),
    when: "inputWidgetFocus",
    async run(accessor) {
        await accessor.get(InputWidgetControllerDIToken).cut(accessor.get(ClipboardDIToken));
    },
};

export const inputPasteAction: CommandAction = {
    id: "input.paste",
    title: "Input: Paste",
    keybinding: parseKeybinding("ctrl+v"),
    when: "inputWidgetFocus",
    async run(accessor) {
        await accessor.get(InputWidgetControllerDIToken).paste(accessor.get(ClipboardDIToken));
    },
};
