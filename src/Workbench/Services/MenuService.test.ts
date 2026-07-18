import { describe, expect, it } from "vitest";

import { ContextKeyService } from "./ContextKeyService.ts";
import { KeybindingRegistry, parseKeybinding } from "./KeybindingRegistry.ts";
import type { IMenuItemModel } from "./MenuService.ts";
import { MenuService } from "./MenuService.ts";

function make(): { service: MenuService; keybindings: KeybindingRegistry } {
    const keybindings = new KeybindingRegistry();
    return { service: new MenuService(keybindings, new ContextKeyService()), keybindings };
}

function items(service: MenuService, menuLabel: string): IMenuItemModel[] {
    const menu = service.getMenus().find((m) => m.label === menuLabel);
    expect(menu, `menu "${menuLabel}" should exist`).toBeDefined();
    return menu!.entries.filter((e): e is IMenuItemModel => e.type === "item");
}

describe("MenuService", () => {
    it("declares the top-level menus with mnemonics", () => {
        const { service } = make();
        expect(service.getMenus().map((m) => [m.label, m.mnemonic])).toEqual([
            ["File", "f"],
            ["Edit", "e"],
            ["Selection", "s"],
            ["View", "v"],
            ["Go", "g"],
            ["Help", "h"],
        ]);
    });

    it("builds items from command ids (label + commandId)", () => {
        const { service } = make();
        const file = items(service, "File");
        expect(file.map((i) => i.label)).toContain("Save");
        expect(file.find((i) => i.label === "Save")?.commandId).toBe("workbench.action.files.save");
        expect(file.find((i) => i.label === "Exit")?.commandId).toBe("workbench.action.quit");
    });

    it("derives the displayed shortcut from the keybinding registry", () => {
        const { service, keybindings } = make();
        keybindings.register(parseKeybinding("ctrl+s"), "workbench.action.files.save");

        const save = items(service, "File").find((i) => i.label === "Save");
        expect(save?.shortcut).toBe("Ctrl+S");
    });

    it("omits the shortcut for commands without a keybinding", () => {
        const { service } = make();
        const about = items(service, "Help").find((i) => i.label === "About");
        expect(about?.shortcut).toBeUndefined();
    });

    it("separates groups with separator entries", () => {
        const { service } = make();
        const file = service.getMenus().find((m) => m.label === "File")!;
        expect(file.entries.some((e) => e.type === "separator")).toBe(true);
    });
});
