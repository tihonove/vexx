import { token } from "../../Common/DiContainer.ts";
import type { IDisposable } from "../../Common/Disposable.ts";
import type { MenuEntry } from "../../TUIDom/Widgets/PopupMenuElement.ts";
import type { CommandRegistry } from "../Services/CommandRegistry.ts";
import { CommandRegistryDIToken } from "../Services/CommandRegistry.ts";
import type { ContextKeyService } from "../Services/ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "../Services/ContextKeyService.ts";
import type { KeybindingRegistry } from "../Services/KeybindingRegistry.ts";
import { formatKeybinding, KeybindingRegistryDIToken } from "../Services/KeybindingRegistry.ts";

import type { IMenuContribution } from "./IMenuContribution.ts";
import { MenuContributionsDIToken } from "./IMenuContribution.ts";
import type { MenuId } from "./MenuId.ts";

export const MenuRegistryDIToken = token<MenuRegistry>("MenuRegistry");

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

    private readonly items: IMenuContribution[];

    public constructor(
        private readonly commands: CommandRegistry,
        private readonly keybindings: KeybindingRegistry,
        private readonly contextKeys: ContextKeyService,
        contributions: readonly IMenuContribution[],
    ) {
        this.items = [...contributions];
    }

    /** Динамически добавить пункт (напр. из расширения); dispose снимает его. */
    public appendMenuItem(item: IMenuContribution): IDisposable {
        this.items.push(item);
        return {
            dispose: () => {
                const index = this.items.indexOf(item);
                if (index >= 0) this.items.splice(index, 1);
            },
        };
    }

    public getMenuItems(menuId: MenuId, context?: unknown): MenuEntry[] {
        const visible = this.items.filter((item) => {
            if (item.menuId !== menuId) return false;
            if (item.when !== undefined && !this.contextKeys.evaluate(item.when)) return false;
            if (item.visible !== undefined && !item.visible(context)) return false;
            return true;
        });

        // Сгруппировать сохраняя порядок вставки, потом отсортировать группы по
        // ключу-строке и пункты внутри по order (стабильно — по индексу вставки).
        const groups = new Map<string, { item: IMenuContribution; index: number }[]>();
        visible.forEach((item, index) => {
            const key = item.group ?? "";
            const bucket = groups.get(key);
            if (bucket) bucket.push({ item, index });
            else groups.set(key, [{ item, index }]);
        });
        const sortedGroups = [...groups.keys()].sort();

        const result: MenuEntry[] = [];
        for (const key of sortedGroups) {
            const bucket = groups.get(key)!;
            bucket.sort((a, b) => (a.item.order ?? 0) - (b.item.order ?? 0) || a.index - b.index);
            // Разделитель — только между непустыми группами (без ведущих/хвостовых).
            if (result.length > 0) result.push({ type: "separator" });
            for (const { item } of bucket) result.push(this.toEntry(item, context));
        }
        return result;
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
