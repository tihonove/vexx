import { describe, expect, it } from "vitest";

import { parseChord, parseKeybinding } from "../KeybindingRegistry.ts";

import { openKeybindingsJsonAction, openSettingsJsonAction } from "./PreferencesActions.ts";

describe("PreferencesActions", () => {
    it("declares the settings command with VS Code id/title and Ctrl+, binding", () => {
        expect(openSettingsJsonAction.id).toBe("workbench.action.openSettingsJson");
        expect(openSettingsJsonAction.title).toBe("Preferences: Open User Settings (JSON)");
        expect(openSettingsJsonAction.keybinding).toEqual(parseKeybinding("ctrl+,"));
    });

    it("declares the keybindings command with VS Code id/title and Ctrl+K Ctrl+S chord", () => {
        expect(openKeybindingsJsonAction.id).toBe("workbench.action.openGlobalKeybindingsFile");
        expect(openKeybindingsJsonAction.title).toBe("Preferences: Open Keyboard Shortcuts (JSON)");
        expect(openKeybindingsJsonAction.keybinding).toEqual(parseChord("ctrl+k ctrl+s"));
    });
});
