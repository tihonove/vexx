import { token } from "../../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../../Common/Disposable.ts";
import type { MenuEntry } from "../../TUIDom/Widgets/PopupMenuElement.ts";

import type { MenuId } from "./MenuId.ts";
import type { ISubmenuEntry, MenuRegistry } from "./MenuRegistry.ts";
import { MenuRegistryDIToken } from "./MenuRegistry.ts";

export const MenuServiceDIToken = token<MenuService>("MenuService");

/**
 * Живое меню одной точки `MenuId` (аналог `IMenu` VS Code): резолвит пункты на
 * момент вызова и уведомляет о смене состава реестра (`onDidChange`) — консюмер
 * пересобирает разметку когда захочет. `when`-контекст учитывается при каждом
 * `getEntries`; событий смены контекст-ключей у нас нет (осознанное подмножество
 * vscode — все наши меню пересобираются при открытии).
 */
export interface IMenu extends IDisposable {
    /** Пункты меню на текущий момент (см. `MenuRegistry.getMenuItems`). */
    getEntries(context?: unknown): MenuEntry[];
    /** Submenu-записи меню (см. `MenuRegistry.getSubmenus`). */
    getSubmenus(): ISubmenuEntry[];
    /** Подписка на смену состава этой точки (append/снятие пункта в реестре). */
    onDidChange(listener: () => void): IDisposable;
}

/**
 * Фабрика живых меню (аналог `IMenuService` VS Code): отделяет данные
 * (`MenuRegistry`) от потребления — консюмеры (меню-бар, контекст-меню)
 * держат `IMenu` и не ходят в реестр напрямую.
 */
export class MenuService {
    public static dependencies = [MenuRegistryDIToken] as const;

    public constructor(private readonly registry: MenuRegistry) {}

    public createMenu(menuId: MenuId): IMenu {
        return new Menu(this.registry, menuId);
    }
}

class Menu extends Disposable implements IMenu {
    private readonly listeners = new Set<() => void>();

    public constructor(
        private readonly registry: MenuRegistry,
        private readonly menuId: MenuId,
    ) {
        super();
        this.register(
            this.registry.onDidChangeMenu((changed) => {
                if (changed !== this.menuId) return;
                for (const listener of [...this.listeners]) {
                    listener();
                }
            }),
        );
    }

    public getEntries(context?: unknown): MenuEntry[] {
        return this.registry.getMenuItems(this.menuId, context);
    }

    public getSubmenus(): ISubmenuEntry[] {
        return this.registry.getSubmenus(this.menuId);
    }

    public onDidChange(listener: () => void): IDisposable {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
    }
}
