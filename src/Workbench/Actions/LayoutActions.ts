import { ProblemsComponentDIToken, PROBLEMS_VIEW_ID } from "../Components/Panel/ProblemsComponent.ts";
import { EditorServiceDIToken } from "../Services/EditorService.ts";
import { ExplorerServiceDIToken } from "../Services/ExplorerService.ts";
import { parseKeybinding } from "../Services/KeybindingRegistry.ts";
import { LayoutServiceDIToken } from "../Services/LayoutService.ts";
import { PanelServiceDIToken } from "../Services/PanelService.ts";
import type { CommandAction } from "./CommandAction.ts";

// Columns added/removed per increase/decrease Side Bar Width command.
const SIDEBAR_WIDTH_STEP = 3;

export const toggleSidebarAction: CommandAction = {
    id: "workbench.action.toggleSidebarVisibility",
    title: "View: Toggle Primary Side Bar Visibility",
    keybinding: parseKeybinding("ctrl+b"),
    run(accessor) {
        accessor.get(LayoutServiceDIToken).toggleSidebar();
    },
};

export const showExplorerAction: CommandAction = {
    id: "workbench.view.explorer",
    title: "View: Show Explorer",
    keybinding: parseKeybinding("ctrl+shift+e"),
    run(accessor) {
        accessor.get(LayoutServiceDIToken).setSidebarVisible(true);
        accessor.get(ExplorerServiceDIToken).focus();
    },
};

export const revealActiveFileInExplorerAction: CommandAction = {
    id: "workbench.files.action.showActiveFileInExplorer",
    title: "File: Reveal Active File in Explorer",
    run(accessor) {
        const filePath = accessor.get(EditorServiceDIToken).getActiveEditor()?.absoluteFilePath;
        if (!filePath) return;
        const explorer = accessor.get(ExplorerServiceDIToken);
        accessor.get(LayoutServiceDIToken).setSidebarVisible(true);
        explorer.focus();
        void explorer.revealPath(filePath);
    },
};

// Side bar width: palette-only, no default keybindings (matching VS Code's
// increase/decreaseViewWidth). Users can bind them via keybindings.json.
export const increaseSidebarWidthAction: CommandAction = {
    id: "workbench.action.increaseSidebarWidth",
    title: "View: Increase Side Bar Width",
    run(accessor) {
        accessor.get(LayoutServiceDIToken).nudgeSidebarWidth(SIDEBAR_WIDTH_STEP);
    },
};

export const decreaseSidebarWidthAction: CommandAction = {
    id: "workbench.action.decreaseSidebarWidth",
    title: "View: Decrease Side Bar Width",
    run(accessor) {
        accessor.get(LayoutServiceDIToken).nudgeSidebarWidth(-SIDEBAR_WIDTH_STEP);
    },
};

export const resetSidebarWidthAction: CommandAction = {
    id: "workbench.action.resetSidebarWidth",
    title: "View: Reset Side Bar Width",
    run(accessor) {
        accessor.get(LayoutServiceDIToken).resetSidebarWidth();
    },
};

// Bottom Panel (Problems/Output/…) visibility.
export const togglePanelAction: CommandAction = {
    id: "workbench.action.togglePanel",
    title: "View: Toggle Panel Visibility",
    keybinding: parseKeybinding("ctrl+j"),
    run(accessor) {
        const layout = accessor.get(LayoutServiceDIToken);
        layout.setPanelVisible(!layout.isPanelVisible());
    },
};

export const toggleProblemsAction: CommandAction = {
    id: "workbench.actions.view.problems",
    title: "View: Toggle Problems (Errors, Warnings, Infos)",
    keybinding: parseKeybinding("ctrl+shift+m"),
    run(accessor) {
        // Toggle like VS Code: show + focus Problems, or hide the panel if
        // Problems is already the visible view.
        const layout = accessor.get(LayoutServiceDIToken);
        const panel = accessor.get(PanelServiceDIToken);
        const showing = layout.isPanelVisible() && panel.getActiveViewId() === PROBLEMS_VIEW_ID;
        if (showing) {
            layout.setPanelVisible(false);
        } else {
            panel.setActiveView(PROBLEMS_VIEW_ID);
            layout.setPanelVisible(true);
            accessor.get(ProblemsComponentDIToken).focus();
        }
    },
};
