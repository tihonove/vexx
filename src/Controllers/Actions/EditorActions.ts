import type { CommandAction } from "../CommandAction.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { parseKeybinding } from "../KeybindingRegistry.ts";

// ─── Basic Cursor Movement ──────────────────────────────────

export const cursorLeftAction: CommandAction = {
    id: "cursorLeft",
    title: "Cursor Left",
    keybinding: parseKeybinding("left"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorLeft();
    },
};

export const cursorLeftSelectAction: CommandAction = {
    id: "cursorLeftSelect",
    title: "Cursor Left Select",
    keybinding: parseKeybinding("shift+left"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorLeft(true);
    },
};

export const cursorRightAction: CommandAction = {
    id: "cursorRight",
    title: "Cursor Right",
    keybinding: parseKeybinding("right"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorRight();
    },
};

export const cursorRightSelectAction: CommandAction = {
    id: "cursorRightSelect",
    title: "Cursor Right Select",
    keybinding: parseKeybinding("shift+right"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorRight(true);
    },
};

export const cursorUpAction: CommandAction = {
    id: "cursorUp",
    title: "Cursor Up",
    keybinding: parseKeybinding("up"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorUp();
    },
};

export const cursorUpSelectAction: CommandAction = {
    id: "cursorUpSelect",
    title: "Cursor Up Select",
    keybinding: parseKeybinding("shift+up"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorUp(true);
    },
};

export const cursorDownAction: CommandAction = {
    id: "cursorDown",
    title: "Cursor Down",
    keybinding: parseKeybinding("down"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorDown();
    },
};

export const cursorDownSelectAction: CommandAction = {
    id: "cursorDownSelect",
    title: "Cursor Down Select",
    keybinding: parseKeybinding("shift+down"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorDown(true);
    },
};

// ─── Home / End ─────────────────────────────────────────────

export const cursorHomeAction: CommandAction = {
    id: "cursorHome",
    title: "Cursor Home",
    keybinding: parseKeybinding("home"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorHome();
    },
};

export const cursorHomeSelectAction: CommandAction = {
    id: "cursorHomeSelect",
    title: "Cursor Home Select",
    keybinding: parseKeybinding("shift+home"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorHome(true);
    },
};

export const cursorEndAction: CommandAction = {
    id: "cursorEnd",
    title: "Cursor End",
    keybinding: parseKeybinding("end"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorEnd();
    },
};

export const cursorEndSelectAction: CommandAction = {
    id: "cursorEndSelect",
    title: "Cursor End Select",
    keybinding: parseKeybinding("shift+end"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorEnd(true);
    },
};

// ─── Document Start / End ───────────────────────────────────

export const cursorTopAction: CommandAction = {
    id: "cursorTop",
    title: "Cursor Top",
    keybinding: parseKeybinding("ctrl+home"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorTop();
    },
};

export const cursorTopSelectAction: CommandAction = {
    id: "cursorTopSelect",
    title: "Cursor Top Select",
    keybinding: parseKeybinding("ctrl+shift+home"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorTop(true);
    },
};

export const cursorBottomAction: CommandAction = {
    id: "cursorBottom",
    title: "Cursor Bottom",
    keybinding: parseKeybinding("ctrl+end"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorBottom();
    },
};

export const cursorBottomSelectAction: CommandAction = {
    id: "cursorBottomSelect",
    title: "Cursor Bottom Select",
    keybinding: parseKeybinding("ctrl+shift+end"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorBottom(true);
    },
};

// ─── Word Navigation ────────────────────────────────────────

export const cursorWordLeftAction: CommandAction = {
    id: "cursorWordLeft",
    title: "Cursor Word Left",
    keybinding: parseKeybinding("ctrl+left"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorWordLeft();
    },
};

export const cursorWordLeftSelectAction: CommandAction = {
    id: "cursorWordLeftSelect",
    title: "Cursor Word Left Select",
    keybinding: parseKeybinding("ctrl+shift+left"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorWordLeft(true);
    },
};

export const cursorWordRightAction: CommandAction = {
    id: "cursorWordRight",
    title: "Cursor Word Right",
    keybinding: parseKeybinding("ctrl+right"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorWordRight();
    },
};

export const cursorWordRightSelectAction: CommandAction = {
    id: "cursorWordRightSelect",
    title: "Cursor Word Right Select",
    keybinding: parseKeybinding("ctrl+shift+right"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorWordRight(true);
    },
};

// ─── Page Navigation ────────────────────────────────────────

export const cursorPageDownAction: CommandAction = {
    id: "cursorPageDown",
    title: "Cursor Page Down",
    keybinding: parseKeybinding("pagedown"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorPageDown();
    },
};

export const cursorPageDownSelectAction: CommandAction = {
    id: "cursorPageDownSelect",
    title: "Cursor Page Down Select",
    keybinding: parseKeybinding("shift+pagedown"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorPageDown(true);
    },
};

export const cursorPageUpAction: CommandAction = {
    id: "cursorPageUp",
    title: "Cursor Page Up",
    keybinding: parseKeybinding("pageup"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorPageUp();
    },
};

export const cursorPageUpSelectAction: CommandAction = {
    id: "cursorPageUpSelect",
    title: "Cursor Page Up Select",
    keybinding: parseKeybinding("shift+pageup"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorGroupControllerDIToken).getActiveEditor()?.viewState.cursorPageUp(true);
    },
};
