import { describe, expect, it } from "vitest";

import type { IExtension } from "../../../../platform/extensions/common/iExtension.ts";
import type { IKeybindingContribution } from "../../../../platform/extensions/common/iExtensionManifest.ts";
import { formatKeybinding, KeybindingRegistry } from "../../../../platform/keybinding/common/keybindingRegistry.ts";

import { registerExtensionKeybindings } from "./extensionKeybindingContributor.ts";

function ext(keybindings: readonly IKeybindingContribution[]): IExtension {
    return {
        id: "test.kb",
        manifest: { name: "kb", publisher: "test", version: "0.0.1", contributes: { keybindings } },
        location: "UserExtensions/test.kb-0.0.1/",
        isBuiltin: false,
    };
}

describe("registerExtensionKeybindings", () => {
    it("регистрирует аккорд с when и командой", () => {
        const registry = new KeybindingRegistry();
        registerExtensionKeybindings(
            [ext([{ command: "regionfolder.wrapWithRegion", key: "ctrl+m ctrl+r", when: "editorTextFocus" }])],
            registry,
            "linux",
        );
        const chord = registry.getKeybindingForCommand("regionfolder.wrapWithRegion");
        expect(chord).toBeDefined();
        expect(formatKeybinding(chord!)).toBe("Ctrl+M Ctrl+R");
    });

    it("платформенный оверрайд mac/win/linux побеждает key", () => {
        const contrib: IKeybindingContribution = {
            command: "cmd",
            key: "ctrl+a",
            mac: "meta+a",
        };
        const mac = new KeybindingRegistry();
        registerExtensionKeybindings([ext([contrib])], mac, "darwin");
        expect(formatKeybinding(mac.getKeybindingForCommand("cmd")!)).toBe("Meta+A");

        const linux = new KeybindingRegistry();
        registerExtensionKeybindings([ext([contrib])], linux, "linux");
        expect(formatKeybinding(linux.getKeybindingForCommand("cmd")!)).toBe("Ctrl+A");
    });

    it("ведущий - в command снимает существующую привязку", () => {
        const registry = new KeybindingRegistry();
        registry.register(
            [
                { key: "k", ctrlKey: true, shiftKey: false, altKey: false, metaKey: false },
                { key: "s", ctrlKey: true, shiftKey: false, altKey: false, metaKey: false },
            ],
            "editor.action.foo",
        );
        expect(registry.getKeybindingForCommand("editor.action.foo")).toBeDefined();

        registerExtensionKeybindings([ext([{ command: "-editor.action.foo", key: "ctrl+k ctrl+s" }])], registry, "linux");
        expect(registry.getKeybindingForCommand("editor.action.foo")).toBeUndefined();
    });

    it("пустой/отсутствующий key пропускается без падения", () => {
        const registry = new KeybindingRegistry();
        registerExtensionKeybindings([ext([{ command: "cmd", key: "" }])], registry, "linux");
        expect(registry.getKeybindingForCommand("cmd")).toBeUndefined();
    });

    it("расширение без contributes.keybindings игнорируется", () => {
        const registry = new KeybindingRegistry();
        const noKb: IExtension = {
            id: "x",
            manifest: { name: "x", publisher: "t", version: "0.0.1" },
            location: "UserExtensions/x/",
            isBuiltin: false,
        };
        expect(() => registerExtensionKeybindings([noKb], registry, "linux")).not.toThrow();
    });
});
