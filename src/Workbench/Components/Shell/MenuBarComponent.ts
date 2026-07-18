import { token } from "../../../Common/DiContainer.ts";
import type { ThemeService } from "../../../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../../../Theme/ThemeTokens.ts";
import type { MenuBarItem } from "../../../TUIDom/Widgets/MenuBarElement.ts";
import { MenuBarElement } from "../../../TUIDom/Widgets/MenuBarElement.ts";
import type { MenuEntry } from "../../../TUIDom/Widgets/PopupMenuElement.ts";
import { ThemedComponent } from "../../Component.ts";
import type { CommandRegistry } from "../../Services/CommandRegistry.ts";
import { CommandRegistryDIToken } from "../../Services/CommandRegistry.ts";
import type { IMenuModel, MenuEntryModel } from "../../Services/MenuService.ts";
import type { MenuService } from "../../Services/MenuService.ts";
import { MenuServiceDIToken } from "../../Services/MenuService.ts";
import { getMenuStyles } from "../../Styles/defaultStyles.ts";

export const MenuBarComponentDIToken = token<MenuBarComponent>("MenuBarComponent");

/**
 * Компонент главного меню: владеет {@link MenuBarElement} и строит его items из
 * декларативной модели {@link MenuService}; выбор пункта исполняет команду через
 * `CommandRegistry`. Резолвить компонент нужно ПОСЛЕ применения user keybindings —
 * шорткаты пунктов снимаются из реестра на момент постройки модели.
 */
export class MenuBarComponent extends ThemedComponent {
    public static dependencies = [MenuServiceDIToken, CommandRegistryDIToken, ThemeServiceDIToken] as const;

    public readonly view: MenuBarElement;

    public constructor(
        menuService: MenuService,
        private readonly commands: CommandRegistry,
        themeService: ThemeService,
    ) {
        super(themeService);
        this.view = new MenuBarElement(menuService.getMenus().map((menu) => this.buildItem(menu)));
        this.view.id = "menuBar";
        this.initStyles();
    }

    private buildItem(menu: IMenuModel): MenuBarItem {
        return {
            label: menu.label,
            mnemonic: menu.mnemonic,
            entries: menu.entries.map((entry) => this.buildEntry(entry)),
        };
    }

    private buildEntry(entry: MenuEntryModel): MenuEntry {
        if (entry.type === "separator") return { type: "separator" };
        return {
            label: entry.label,
            shortcut: entry.shortcut,
            onSelect: () => {
                this.commands.execute(entry.commandId);
            },
        };
    }

    protected updateStyles(): void {
        this.view.setStyles(getMenuStyles(this.theme));
    }
}
