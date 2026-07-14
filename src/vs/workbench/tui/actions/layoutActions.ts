import type { IDisposable } from "../../../base/common/lifecycle.ts";
import { registerAction } from "../../../platform/commands/common/commandAction.ts";
import type { CommandRegistry } from "../../../platform/commands/common/commands.ts";
import type { ServiceAccessor } from "../../../platform/instantiation/common/instantiation.ts";
import type { KeybindingRegistry } from "../../../platform/keybinding/common/keybindingsRegistry.ts";
import { parseKeybinding } from "../../../platform/keybinding/common/keybindingsRegistry.ts";
import type { FileTreeController } from "../../contrib/files/tui/fileTreeController.ts";
import type { ProblemsController } from "../../contrib/markers/tui/problemsController.ts";
import type { PanelController } from "../parts/panel/panelController.ts";
import type { WorkbenchLayoutElement } from "../layout.ts";

// Columns added/removed per increase/decrease Side Bar Width command.
const SIDEBAR_WIDTH_STEP = 3;

interface ILayoutActionsDeps {
    readonly commands: CommandRegistry;
    readonly keybindings: KeybindingRegistry;
    readonly accessor: ServiceAccessor;
    readonly layout: WorkbenchLayoutElement;
    readonly fileTree: FileTreeController;
    readonly panelController: PanelController;
    readonly problemsController: ProblemsController;
    /** Показ/скрытие нижней панели с синхронизацией context key `panelVisible`. */
    setPanelVisible(visible: boolean): void;
}

/**
 * Layout-команды воркбенча (аналог vscode `workbench/browser/actions/layoutActions.ts`):
 * видимость и ширина сайдбара, видимость нижней панели, показ Explorer/Problems.
 * Возвращает disposables регистраций — владеет ими вызывающий воркбенч.
 */
export function registerLayoutActions(deps: ILayoutActionsDeps): IDisposable[] {
    const { commands, keybindings, accessor, layout } = deps;
    return [
        registerAction(commands, keybindings, accessor, {
            id: "workbench.action.toggleSidebarVisibility",
            title: "View: Toggle Primary Side Bar Visibility",
            keybinding: parseKeybinding("ctrl+b"),
            run: () => {
                const visible = layout.getLeftPanelVisible();
                layout.setLeftPanelVisible(!visible);
                layout.markDirty();
            },
        }),
        registerAction(commands, keybindings, accessor, {
            id: "workbench.view.explorer",
            title: "View: Show Explorer",
            keybinding: parseKeybinding("ctrl+shift+e"),
            run: () => {
                layout.setLeftPanelVisible(true);
                layout.markDirty();
                deps.fileTree.focus();
            },
        }),
        // Side bar width: palette-only, no default keybindings (matching VS Code's
        // increase/decreaseViewWidth). Users can bind them via keybindings.json.
        registerAction(commands, keybindings, accessor, {
            id: "workbench.action.increaseSidebarWidth",
            title: "View: Increase Side Bar Width",
            run: () => {
                layout.nudgeLeftPanelWidth(SIDEBAR_WIDTH_STEP);
            },
        }),
        registerAction(commands, keybindings, accessor, {
            id: "workbench.action.decreaseSidebarWidth",
            title: "View: Decrease Side Bar Width",
            run: () => {
                layout.nudgeLeftPanelWidth(-SIDEBAR_WIDTH_STEP);
            },
        }),
        registerAction(commands, keybindings, accessor, {
            id: "workbench.action.resetSidebarWidth",
            title: "View: Reset Side Bar Width",
            run: () => {
                layout.resetLeftPanelWidth();
            },
        }),
        // Bottom Panel (Problems/Output/…) visibility.
        registerAction(commands, keybindings, accessor, {
            id: "workbench.action.togglePanel",
            title: "View: Toggle Panel Visibility",
            keybinding: parseKeybinding("ctrl+j"),
            run: () => {
                deps.setPanelVisible(!layout.getBottomPanelVisible());
            },
        }),
        registerAction(commands, keybindings, accessor, {
            id: "workbench.actions.view.problems",
            title: "View: Toggle Problems (Errors, Warnings, Infos)",
            keybinding: parseKeybinding("ctrl+shift+m"),
            run: () => {
                // Toggle like VS Code: show + focus Problems, or hide the panel if
                // Problems is already the visible view.
                const showing = layout.getBottomPanelVisible() && deps.panelController.isProblemsActive();
                if (showing) {
                    deps.setPanelVisible(false);
                } else {
                    deps.panelController.showProblems();
                    deps.setPanelVisible(true);
                    deps.problemsController.focus();
                }
            },
        }),
    ];
}
