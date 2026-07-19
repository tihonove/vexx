import { MenuId } from "../../../../platform/actions/common/menuId.ts";
import { parseChord, parseKeybinding } from "../../../../platform/keybinding/common/keybindingRegistry.ts";
import { CommandsQuickAccessProvider } from "./commandsQuickAccessProvider.ts";
import { GotoLineQuickAccessProvider } from "./gotoLineQuickAccessProvider.ts";
import { QuickOpenServiceDIToken } from "./quickOpenService.ts";

import type { CommandAction } from "../../../../platform/actions/common/commandAction.ts";

export const quickOpenAction: CommandAction = {
    id: "workbench.action.quickOpen",
    title: "Go to File...",
    menus: [{ menuId: MenuId.MenubarGoMenu, group: "1_goto", order: 10 }],
    keybinding: parseKeybinding("ctrl+p"),
    run(accessor) {
        accessor.get(QuickOpenServiceDIToken).show();
    },
};

export const gotoLineAction: CommandAction = {
    id: "workbench.action.gotoLine",
    title: "Go to Line/Column...",
    menus: [{ menuId: MenuId.MenubarGoMenu, group: "1_goto", order: 20 }],
    keybinding: parseKeybinding("ctrl+g"),
    run(accessor) {
        accessor.get(QuickOpenServiceDIToken).show(GotoLineQuickAccessProvider.PREFIX);
    },
};

export const showCommandsAction: CommandAction = {
    id: "workbench.action.showCommands",
    title: "Show All Commands",
    menus: [{ menuId: MenuId.MenubarViewMenu, title: "Command Palette...", group: "1_palette", order: 10 }],
    keybinding: parseKeybinding("ctrl+shift+p"),
    // Ctrl+Shift+letter is unreliable on legacy terminals — add the VS Code chord fallback.
    keybindings: [{ keys: parseChord("ctrl+k ctrl+p"), when: "tier == 'legacy'" }],
    run(accessor) {
        accessor.get(QuickOpenServiceDIToken).show(CommandsQuickAccessProvider.PREFIX);
    },
};
