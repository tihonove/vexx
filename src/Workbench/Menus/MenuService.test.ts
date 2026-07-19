import { describe, expect, it } from "vitest";

import { CommandRegistry } from "../Services/CommandRegistry.ts";
import { ContextKeyService } from "../Services/ContextKeyService.ts";
import { KeybindingRegistry } from "../Services/KeybindingRegistry.ts";

import type { MenuContribution } from "./IMenuContribution.ts";
import { MenuId } from "./MenuId.ts";
import { MenuRegistry } from "./MenuRegistry.ts";
import { MenuService } from "./MenuService.ts";

function setup(items: MenuContribution[] = []): { registry: MenuRegistry; service: MenuService } {
    const registry = new MenuRegistry(new CommandRegistry(), new KeybindingRegistry(), new ContextKeyService(), items);
    return { registry, service: new MenuService(registry) };
}

describe("MenuService — живые меню (IMenu)", () => {
    it("getEntries резолвит пункты своей точки через реестр (с контекстом)", () => {
        const seen: unknown[] = [];
        const { service } = setup([
            {
                menuId: MenuId.ExplorerContext,
                command: "cmd",
                title: "Cmd",
                visible: (ctx) => {
                    seen.push(ctx);
                    return true;
                },
            },
        ]);
        const menu = service.createMenu(MenuId.ExplorerContext);
        const entries = menu.getEntries({ path: "/x" });
        expect(entries.map((e) => (e.type === "separator" ? "─" : e.label))).toEqual(["Cmd"]);
        expect(seen).toEqual([{ path: "/x" }]);
    });

    it("getSubmenus отдаёт submenu-записи своей точки", () => {
        const { service } = setup([
            { menuId: MenuId.MenubarMainMenu, submenu: MenuId.MenubarFileMenu, title: "File", mnemonic: "f" },
        ]);
        const menu = service.createMenu(MenuId.MenubarMainMenu);
        expect(menu.getSubmenus()).toEqual([{ title: "File", mnemonic: "f", submenu: MenuId.MenubarFileMenu }]);
    });

    it("onDidChange: уведомляет о смене своей точки и молчит о чужой", () => {
        const { registry, service } = setup();
        const menu = service.createMenu(MenuId.EditorContext);
        let fired = 0;
        menu.onDidChange(() => fired++);

        registry.appendMenuItem({ menuId: MenuId.ExplorerContext, command: "other" });
        expect(fired).toBe(0);

        const handle = registry.appendMenuItem({ menuId: MenuId.EditorContext, command: "mine" });
        expect(fired).toBe(1);
        handle.dispose(); // снятие пункта — тоже изменение
        expect(fired).toBe(2);
    });

    it("dispose подписки листенера прекращает уведомления", () => {
        const { registry, service } = setup();
        const menu = service.createMenu(MenuId.EditorContext);
        let fired = 0;
        const subscription = menu.onDidChange(() => fired++);
        subscription.dispose();

        registry.appendMenuItem({ menuId: MenuId.EditorContext, command: "x" });
        expect(fired).toBe(0);
    });

    it("dispose меню отписывает его от реестра", () => {
        const { registry, service } = setup();
        const menu = service.createMenu(MenuId.EditorContext);
        let fired = 0;
        menu.onDidChange(() => fired++);
        menu.dispose();

        registry.appendMenuItem({ menuId: MenuId.EditorContext, command: "x" });
        expect(fired).toBe(0);
    });
});
