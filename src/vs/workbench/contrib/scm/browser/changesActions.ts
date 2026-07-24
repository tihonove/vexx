import type { CommandAction } from "../../../../platform/actions/common/commandAction.ts";
import { MenuId } from "../../../../platform/actions/common/menuId.ts";
import { parseChord } from "../../../../platform/keybinding/common/keybindingRegistry.ts";
import { PanelServiceDIToken } from "../../../browser/parts/panel/panelService.ts";
import { LayoutServiceDIToken } from "../../../services/layout/browser/layoutService.ts";

import { CHANGES_VIEW_ID, ChangesComponentDIToken } from "./changesComponent.ts";

/**
 * Показать/скрыть вкладку Changes нижней панели. Поведение — как у Toggle Output/
 * Problems: показать и сфокусировать, а если вкладка уже видима — свернуть панель.
 *
 * Кейбинд — `ctrl+k ctrl+g` (g — git), по образцу `ctrl+k ctrl+h` у Output: у VS
 * Code SCM это `Ctrl+Shift+G`, но `Ctrl+Shift+<буква>` у нас терминал не кодирует.
 */
export const toggleChangesAction: CommandAction = {
    id: "workbench.action.scm.toggleChanges",
    title: "View: Toggle Changes",
    shortTitle: "Changes",
    menus: [{ menuId: MenuId.MenubarViewMenu, group: "3_views", order: 35 }],
    keybinding: parseChord("ctrl+k ctrl+g"),
    run(accessor) {
        const layout = accessor.get(LayoutServiceDIToken);
        const panel = accessor.get(PanelServiceDIToken);
        const showing = layout.isPanelVisible() && panel.getActiveViewId() === CHANGES_VIEW_ID;
        if (showing) {
            layout.setPanelVisible(false);
            return;
        }
        panel.setActiveView(CHANGES_VIEW_ID);
        layout.setPanelVisible(true);
        accessor.get(ChangesComponentDIToken).focus();
    },
};
