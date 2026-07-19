import type { MenuBarItem } from "../../../../tuidom/ui/menu/menuBarElement.ts";
import { MenuBarElement } from "../../../../tuidom/ui/menu/menuBarElement.ts";
import { MenuId } from "../../platform/actions/common/menuId.ts";
import type { IMenu, MenuService } from "../../platform/actions/common/menuService.ts";
import { MenuServiceDIToken } from "../../platform/actions/common/menuService.ts";
import { token } from "../../platform/instantiation/common/diContainer.ts";
import { getMenuStyles } from "../../platform/theme/browser/defaultStyles.ts";
import type { ThemeService } from "../services/themes/common/themeService.ts";
import { ThemeServiceDIToken } from "../services/themes/common/themeTokens.ts";

import { ThemedComponent } from "./component.ts";

export const MenuBarComponentDIToken = token<MenuBarComponent>("MenuBarComponent");

/**
 * Компонент главного меню: владеет {@link MenuBarElement} и строит его items из
 * `MenuRegistry` через живые меню {@link MenuService.createMenu}: top-уровень —
 * submenu-записи `MenuId.MenubarMainMenu`, пункты каждого меню резолвятся
 * ЛЕНИВО при открытии (геттер `entries`), поэтому шорткаты и динамические
 * пункты всегда актуальны — порядок резолва компонента относительно user
 * keybindings не важен.
 */
export class MenuBarComponent extends ThemedComponent {
    public static dependencies = [MenuServiceDIToken, ThemeServiceDIToken] as const;

    public readonly view: MenuBarElement;

    public constructor(menuService: MenuService, themeService: ThemeService) {
        super(themeService);
        const mainMenu = this.register(menuService.createMenu(MenuId.MenubarMainMenu));
        this.view = new MenuBarElement(mainMenu.getSubmenus().map((sub) => this.buildItem(menuService, sub)));
        this.view.id = "menuBar";
        this.initStyles();
    }

    private buildItem(
        menuService: MenuService,
        sub: { title: string; mnemonic?: string; submenu: MenuId },
    ): MenuBarItem {
        const menu: IMenu = this.register(menuService.createMenu(sub.submenu));
        return {
            label: sub.title,
            mnemonic: sub.mnemonic,
            // Ленивый резолв: MenuBarElement читает entries при открытии попапа.
            get entries() {
                return menu.getEntries();
            },
        };
    }

    protected updateStyles(): void {
        this.view.setStyles(getMenuStyles(this.theme));
    }
}
