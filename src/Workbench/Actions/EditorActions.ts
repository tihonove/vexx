import { EditorServiceDIToken } from "../Services/EditorService.ts";
import { parseChord, parseKeybinding } from "../Services/KeybindingRegistry.ts";

import type { CommandAction } from "./CommandAction.ts";

// ─── Basic Cursor Movement ──────────────────────────────────

export const cursorLeftAction: CommandAction = {
    id: "cursorLeft",
    title: "Cursor Left",
    keybinding: parseKeybinding("left"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorLeft();
    },
};

export const cursorLeftSelectAction: CommandAction = {
    id: "cursorLeftSelect",
    title: "Cursor Left Select",
    keybinding: parseKeybinding("shift+left"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorLeft(true);
    },
};

export const cursorRightAction: CommandAction = {
    id: "cursorRight",
    title: "Cursor Right",
    keybinding: parseKeybinding("right"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorRight();
    },
};

export const cursorRightSelectAction: CommandAction = {
    id: "cursorRightSelect",
    title: "Cursor Right Select",
    keybinding: parseKeybinding("shift+right"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorRight(true);
    },
};

export const cursorUpAction: CommandAction = {
    id: "cursorUp",
    title: "Cursor Up",
    keybinding: parseKeybinding("up"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorUp();
    },
};

export const cursorUpSelectAction: CommandAction = {
    id: "cursorUpSelect",
    title: "Cursor Up Select",
    keybinding: parseKeybinding("shift+up"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorUp(true);
    },
};

export const cursorDownAction: CommandAction = {
    id: "cursorDown",
    title: "Cursor Down",
    keybinding: parseKeybinding("down"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorDown();
    },
};

export const cursorDownSelectAction: CommandAction = {
    id: "cursorDownSelect",
    title: "Cursor Down Select",
    keybinding: parseKeybinding("shift+down"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorDown(true);
    },
};

// ─── Home / End ─────────────────────────────────────────────

export const cursorHomeAction: CommandAction = {
    id: "cursorHome",
    title: "Cursor Home",
    keybinding: parseKeybinding("home"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorHome();
    },
};

export const cursorHomeSelectAction: CommandAction = {
    id: "cursorHomeSelect",
    title: "Cursor Home Select",
    keybinding: parseKeybinding("shift+home"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorHome(true);
    },
};

export const cursorEndAction: CommandAction = {
    id: "cursorEnd",
    title: "Cursor End",
    keybinding: parseKeybinding("end"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorEnd();
    },
};

export const cursorEndSelectAction: CommandAction = {
    id: "cursorEndSelect",
    title: "Cursor End Select",
    keybinding: parseKeybinding("shift+end"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorEnd(true);
    },
};

// ─── Document Start / End ───────────────────────────────────

export const cursorTopAction: CommandAction = {
    id: "cursorTop",
    title: "Cursor Top",
    keybinding: parseKeybinding("ctrl+home"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorTop();
    },
};

export const cursorTopSelectAction: CommandAction = {
    id: "cursorTopSelect",
    title: "Cursor Top Select",
    keybinding: parseKeybinding("ctrl+shift+home"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorTop(true);
    },
};

export const cursorBottomAction: CommandAction = {
    id: "cursorBottom",
    title: "Cursor Bottom",
    keybinding: parseKeybinding("ctrl+end"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorBottom();
    },
};

export const cursorBottomSelectAction: CommandAction = {
    id: "cursorBottomSelect",
    title: "Cursor Bottom Select",
    keybinding: parseKeybinding("ctrl+shift+end"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorBottom(true);
    },
};

// ─── Word Navigation ────────────────────────────────────────

// Word motions keep the canonical VS Code combo on every tier; on `legacy` (where the
// terminal often can't disambiguate Ctrl/Ctrl+Shift+Arrow) we add single-key and leader-chord
// fallbacks so the function is still reachable — breadth preserved, ergonomics degrade gracefully.
export const cursorWordLeftAction: CommandAction = {
    id: "cursorWordLeft",
    title: "Cursor Word Left",
    keybinding: parseKeybinding("ctrl+left"),
    keybindings: [
        { keys: parseKeybinding("alt+left"), when: "tier == 'legacy'" },
        { keys: parseChord("ctrl+k left"), when: "tier == 'legacy'" },
    ],
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorWordLeft();
    },
};

export const cursorWordLeftSelectAction: CommandAction = {
    id: "cursorWordLeftSelect",
    title: "Cursor Word Left Select",
    keybinding: parseKeybinding("ctrl+shift+left"),
    keybindings: [{ keys: parseChord("ctrl+k shift+left"), when: "tier == 'legacy'" }],
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorWordLeft(true);
    },
};

export const cursorWordRightAction: CommandAction = {
    id: "cursorWordRight",
    title: "Cursor Word Right",
    keybinding: parseKeybinding("ctrl+right"),
    keybindings: [
        { keys: parseKeybinding("alt+right"), when: "tier == 'legacy'" },
        { keys: parseChord("ctrl+k right"), when: "tier == 'legacy'" },
    ],
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorWordRight();
    },
};

export const cursorWordRightSelectAction: CommandAction = {
    id: "cursorWordRightSelect",
    title: "Cursor Word Right Select",
    keybinding: parseKeybinding("ctrl+shift+right"),
    keybindings: [{ keys: parseChord("ctrl+k shift+right"), when: "tier == 'legacy'" }],
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorWordRight(true);
    },
};

// ─── Page Navigation ────────────────────────────────────────

export const cursorPageDownAction: CommandAction = {
    id: "cursorPageDown",
    title: "Cursor Page Down",
    keybinding: parseKeybinding("pagedown"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorPageDown();
    },
};

export const cursorPageDownSelectAction: CommandAction = {
    id: "cursorPageDownSelect",
    title: "Cursor Page Down Select",
    keybinding: parseKeybinding("shift+pagedown"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorPageDown(true);
    },
};

export const cursorPageUpAction: CommandAction = {
    id: "cursorPageUp",
    title: "Cursor Page Up",
    keybinding: parseKeybinding("pageup"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorPageUp();
    },
};

export const cursorPageUpSelectAction: CommandAction = {
    id: "cursorPageUpSelect",
    title: "Cursor Page Up Select",
    keybinding: parseKeybinding("shift+pageup"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.cursorPageUp(true);
    },
};

// ─── Scroll View ────────────────────────────────────────────

export const scrollLineUpAction: CommandAction = {
    id: "scrollLineUp",
    title: "Scroll Line Up",
    keybinding: parseKeybinding("ctrl+up"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.scrollLineUp();
    },
};

export const scrollLineDownAction: CommandAction = {
    id: "scrollLineDown",
    title: "Scroll Line Down",
    keybinding: parseKeybinding("ctrl+down"),
    when: "textInputFocus",
    run(accessor) {
        accessor.get(EditorServiceDIToken).getActiveEditor()?.viewState.scrollLineDown();
    },
};
