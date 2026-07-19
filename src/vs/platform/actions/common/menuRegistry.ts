import type { MenuEntry } from "../../../base/browser/ui/menu/popupMenuElement.ts";
import type { IDisposable } from "../../../base/common/disposable.ts";
import type { CommandRegistry } from "../../commands/common/commandRegistry.ts";
import { CommandRegistryDIToken } from "../../commands/common/commandRegistry.ts";
import type { ContextKeyService } from "../../contextkey/common/contextKeyService.ts";
import { ContextKeyServiceDIToken } from "../../contextkey/common/contextKeyService.ts";
import { token } from "../../instantiation/common/diContainer.ts";
import type { KeybindingRegistry } from "../../keybinding/common/keybindingRegistry.ts";
import { formatKeybinding, KeybindingRegistryDIToken } from "../../keybinding/common/keybindingRegistry.ts";

import type { IMenuContribution, ISubmenuContribution, MenuContribution } from "./iMenuContribution.ts";
import { isSubmenuContribution, MenuContributionsDIToken } from "./iMenuContribution.ts";
import type { MenuId } from "./menuId.ts";

/** Резолвнутая submenu-запись (для меню-бара): label + мнемоника + вложенная точка. */
export interface ISubmenuEntry {
    readonly title: string;
    readonly mnemonic?: string;
    readonly submenu: MenuId;
}

export const MenuRegistryDIToken = token<MenuRegistry>("MenuRegistry");

/**
 * Порядок групп: спец-группа `navigation` всегда первая (как в
 * `_compareMenuItems` VS Code), остальные — по строковому ключу. Ключи в
 * пределах одного меню уникальны, поэтому ветки равенства нет.
 */
function compareGroups(a: string, b: string): number {
    if (a === "navigation") return -1;
    if (b === "navigation") return 1;
    return a < b ? -1 : 1;
}

/**
 * Сгруппировать сохраняя порядок вставки, отсортировать группы (navigation →
 * строковый ключ) и пункты внутри по order (стабильно — по индексу вставки).
 */
function collectSorted<T extends { group?: string; order?: number }>(items: readonly T[]): T[][] {
    const groups = new Map<string, { item: T; index: number }[]>();
    items.forEach((item, index) => {
        const key = item.group ?? "";
        const bucket = groups.get(key);
        if (bucket) bucket.push({ item, index });
        else groups.set(key, [{ item, index }]);
    });
    return [...groups.keys()].sort(compareGroups).map((key) => {
        const bucket = groups.get(key)!;
        bucket.sort((a, b) => (a.item.order ?? 0) - (b.item.order ?? 0) || a.index - b.index);
        return bucket.map((entry) => entry.item);
    });
}

/**
 * Реестр declarative menu-contributions (аналог `MenuRegistry` VS Code): по
 * `menuId` фильтрует пункты (`when` + `visible`), сортирует по group/order,
 * вставляет разделители между непустыми группами и резолвит в `MenuEntry`
 * (label из title команды / явного, шорткат из `KeybindingRegistry`, args и
 * `onSelect → CommandRegistry.execute`). Чистая функция реестров команд/
 * кейбиндов/контекст-ключей — состояние открытия (напр. буфер обмена) приходит
 * параметром `context`, не через DI.
 */
export class MenuRegistry {
    public static dependencies = [
        CommandRegistryDIToken,
        KeybindingRegistryDIToken,
        ContextKeyServiceDIToken,
        MenuContributionsDIToken,
    ] as const;

    private readonly items: MenuContribution[];
    private readonly changeListeners = new Set<(menuId: MenuId) => void>();

    public constructor(
        private readonly commands: CommandRegistry,
        private readonly keybindings: KeybindingRegistry,
        private readonly contextKeys: ContextKeyService,
        contributions: readonly MenuContribution[],
    ) {
        this.items = [...contributions];
    }

    /** Динамически добавить пункт (напр. из расширения); dispose снимает его. */
    public appendMenuItem(item: MenuContribution): IDisposable {
        this.items.push(item);
        this.fireDidChangeMenu(item.menuId);
        return {
            dispose: () => {
                const index = this.items.indexOf(item);
                if (index >= 0) {
                    this.items.splice(index, 1);
                    this.fireDidChangeMenu(item.menuId);
                }
            },
        };
    }

    /**
     * Подписка на изменение состава меню (аналог `onDidChangeMenu` VS Code):
     * срабатывает при `appendMenuItem` и снятии пункта. Живой пересбор по
     * событию — забота консюмера (`IMenu` в `MenuService`).
     */
    public onDidChangeMenu(listener: (menuId: MenuId) => void): IDisposable {
        this.changeListeners.add(listener);
        return { dispose: () => this.changeListeners.delete(listener) };
    }

    private fireDidChangeMenu(menuId: MenuId): void {
        for (const listener of [...this.changeListeners]) {
            listener(menuId);
        }
    }

    public getMenuItems(menuId: MenuId, context?: unknown): MenuEntry[] {
        const visible = this.items.filter((item): item is IMenuContribution => {
            if (item.menuId !== menuId) return false;
            // Вложенные попапы в обычных меню не рендерим — submenu-записи
            // потребляет только `getSubmenus` (меню-бар).
            if (isSubmenuContribution(item)) return false;
            if (item.when !== undefined && !this.contextKeys.evaluate(item.when)) return false;
            if (item.visible !== undefined && !item.visible(context)) return false;
            return true;
        });

        const result: MenuEntry[] = [];
        for (const bucket of collectSorted(visible)) {
            // Разделитель — только между непустыми группами (без ведущих/хвостовых).
            if (result.length > 0) result.push({ type: "separator" });
            for (const item of bucket) result.push(this.toEntry(item, context));
        }
        return result;
    }

    /**
     * Submenu-записи меню (тот же when-фильтр и group/order-сортировка, но без
     * разделителей): из них меню-бар строит свои top-уровневые пункты.
     */
    public getSubmenus(menuId: MenuId): ISubmenuEntry[] {
        const visible = this.items.filter((item): item is ISubmenuContribution => {
            if (item.menuId !== menuId) return false;
            if (!isSubmenuContribution(item)) return false;
            if (item.when !== undefined && !this.contextKeys.evaluate(item.when)) return false;
            return true;
        });
        return collectSorted(visible)
            .flat()
            .map((item) => ({ title: item.title, mnemonic: item.mnemonic, submenu: item.submenu }));
    }

    private toEntry(item: IMenuContribution, context: unknown): MenuEntry {
        const label = item.title ?? this.commands.getTitle(item.command) ?? item.command;
        const resolvedArgs = item.args ? item.args(context) : [];
        return {
            label,
            shortcut: this.resolveShortcut(item),
            icon: item.icon,
            onSelect: () => {
                this.commands.execute(item.command, ...resolvedArgs);
            },
        };
    }

    private resolveShortcut(item: IMenuContribution): string | undefined {
        if (item.shortcut === false) return undefined;
        if (typeof item.shortcut === "string") return item.shortcut;
        const chord = this.keybindings.getKeybindingForCommand(item.command, this.contextKeys);
        return chord ? formatKeybinding(chord) : undefined;
    }
}
