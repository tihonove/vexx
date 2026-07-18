import { parseKeybinding } from "../Services/KeybindingRegistry.ts";
import { LayoutServiceDIToken } from "../Services/LayoutService.ts";
import { PanelServiceDIToken } from "../Services/PanelService.ts";
import { TERMINAL_VIEW_ID, TerminalServiceDIToken } from "../Services/Terminal/TerminalService.ts";
import { WorkbenchContextKeysDIToken } from "../Services/WorkbenchContextKeys.ts";

import type { CommandAction } from "./CommandAction.ts";

// Integrated Terminal. Только tier csi-u/kitty умеет однозначно кодировать
// Ctrl+` (в legacy это NUL = Ctrl+Space), поэтому legacy-бинда нет.
export const toggleTerminalAction: CommandAction = {
    id: "workbench.action.terminal.toggleTerminal",
    title: "Terminal: Toggle Terminal",
    keybinding: { keys: parseKeybinding("ctrl+`"), when: "tier == 'kitty' || tier == 'csi-u'" },
    run(accessor) {
        // Toggle like VS Code: hide the panel if Terminal is already the
        // visible view, otherwise show + spawn/focus a terminal.
        const layout = accessor.get(LayoutServiceDIToken);
        const panel = accessor.get(PanelServiceDIToken);
        const showing = layout.isPanelVisible() && panel.getActiveViewId() === TERMINAL_VIEW_ID;
        if (showing) {
            layout.setPanelVisible(false);
        } else {
            panel.setActiveView(TERMINAL_VIEW_ID);
            layout.setPanelVisible(true);
            accessor.get(TerminalServiceDIToken).openTerminal();
            accessor.get(WorkbenchContextKeysDIToken).update();
        }
    },
};

// С зажатым Shift Kitty может слать shifted codepoint (`~`) вместо базового `` ` `` —
// зависит от терминала, поэтому регистрируем обе формы: Ctrl+Shift+` и Ctrl+Shift+~.
export const newTerminalAction: CommandAction = {
    id: "workbench.action.terminal.new",
    title: "Terminal: Create New Terminal",
    keybindings: [
        { keys: parseKeybinding("ctrl+shift+`"), when: "tier == 'kitty' || tier == 'csi-u'" },
        { keys: parseKeybinding("ctrl+shift+~"), when: "tier == 'kitty' || tier == 'csi-u'" },
    ],
    run(accessor) {
        accessor.get(PanelServiceDIToken).setActiveView(TERMINAL_VIEW_ID);
        accessor.get(LayoutServiceDIToken).setPanelVisible(true);
        accessor.get(TerminalServiceDIToken).newTerminal();
        accessor.get(WorkbenchContextKeysDIToken).update();
    },
};
