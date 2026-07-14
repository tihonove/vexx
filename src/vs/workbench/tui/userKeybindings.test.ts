import { describe, expect, it } from "vitest";

import type { IUserKeybindingRule } from "../../platform/keybinding/node/keybindingsService.ts";

import { AppControllerDIToken } from "./workbench.ts";
import type { KeyboardEventLike } from "../../platform/keybinding/common/keybindingsRegistry.ts";
import { KeybindingRegistryDIToken } from "../../platform/keybinding/common/keybindingsRegistry.ts";
import { UserKeybindingsDIToken } from "../../platform/keybinding/node/keybindingsService.ts";
import { createTestContainer } from "../../vexx/modules/testProfile.ts";

const KEY = (key: string, mods: Partial<KeyboardEventLike> = {}): KeyboardEventLike => ({
    key,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...mods,
});

/** Build an app whose user keybindings.json is the given rules, return its registry. */
function appWithRules(rules: IUserKeybindingRule[]) {
    const { container } = createTestContainer();
    // Rebind before the AppController is constructed (rules are read in its constructor).
    container.bind(UserKeybindingsDIToken, () => rules);
    container.get(AppControllerDIToken);
    const keybindings = container.get(KeybindingRegistryDIToken);
    return { keybindings };
}

function resolve(keybindings: ReturnType<typeof appWithRules>["keybindings"], event: KeyboardEventLike) {
    const res = keybindings.resolveKey(event);
    return res.kind === "command" ? res.commandId : undefined;
}

describe("AppController — user keybindings.json", () => {
    it("registers a user binding (no when) so the key resolves to the command", () => {
        const { keybindings } = appWithRules([{ key: "ctrl+alt+k", command: "workbench.action.files.save" }]);
        expect(resolve(keybindings, KEY("k", { ctrlKey: true, altKey: true }))).toBe("workbench.action.files.save");
    });

    it("unbinds a default command with -command, making its key inert", () => {
        // ctrl+b → toggle sidebar (a default with no when).
        const before = appWithRules([]);
        expect(resolve(before.keybindings, KEY("b", { ctrlKey: true }))).toBe(
            "workbench.action.toggleSidebarVisibility",
        );

        const after = appWithRules([{ key: "ctrl+b", command: "-workbench.action.toggleSidebarVisibility" }]);
        expect(resolve(after.keybindings, KEY("b", { ctrlKey: true }))).toBeUndefined();
    });

    it("a user binding registered last wins over a default on the same key", () => {
        const { keybindings } = appWithRules([{ key: "ctrl+b", command: "user.custom.command" }]);
        expect(resolve(keybindings, KEY("b", { ctrlKey: true }))).toBe("user.custom.command");
    });

    it("an unbind rule with an empty key removes ALL bindings for the command", () => {
        // The default command can be triggered by ctrl+s (its sole default binding).
        const before = appWithRules([]);
        expect(resolve(before.keybindings, KEY("s", { ctrlKey: true }))).toBe("workbench.action.files.save");

        // `-command` with no key (stored as "") unbinds every binding for that command.
        const after = appWithRules([{ key: "", command: "-workbench.action.files.save" }]);
        expect(resolve(after.keybindings, KEY("s", { ctrlKey: true }))).toBeUndefined();
    });
});
