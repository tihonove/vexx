import type { CommandAction } from "../../../platform/actions/common/commandAction.ts";
import { MenuId } from "../../../platform/actions/common/menuId.ts";
import { parseKeybinding } from "../../../platform/keybinding/common/keybindingRegistry.ts";
import { SearchComponentDIToken } from "../../contrib/search/browser/searchComponent.ts";
import { LayoutServiceDIToken } from "../../services/layout/browser/layoutService.ts";
import { SEARCH_VIEW_ID, SidebarServiceDIToken } from "../parts/sidebar/sidebarService.ts";

/**
 * Показать вид Search в сайдбаре (Ctrl+Shift+F) — сделать его активным, раскрыть
 * сайдбар и сфокусировать строку запроса. Парный `showExplorerAction`
 * (layoutActions.ts) делает то же для Explorer; вместе они и есть переключатель
 * сайдбара (activity bar в проекте нет).
 */
export const showSearchAction: CommandAction = {
    id: SEARCH_VIEW_ID,
    title: "View: Show Search",
    shortTitle: "Search",
    menus: [{ menuId: MenuId.MenubarViewMenu, group: "3_views", order: 15 }],
    keybinding: parseKeybinding("ctrl+shift+f"),
    run(accessor) {
        accessor.get(SidebarServiceDIToken).setActiveView(SEARCH_VIEW_ID);
        accessor.get(LayoutServiceDIToken).setSidebarVisible(true);
        accessor.get(SearchComponentDIToken).focus();
    },
};
