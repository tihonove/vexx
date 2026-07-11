import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { PanelContainerElement } from "../TUIDom/Widgets/PanelContainerElement.ts";

import type { IController } from "./IController.ts";

export const PanelControllerDIToken = token<PanelController>("PanelController");

/** VS Code view id of the Problems (Markers) view living in the bottom Panel. */
export const PROBLEMS_VIEW_ID = "workbench.panel.markers.view";

/**
 * Owns the bottom **Panel** part ({@link PanelContainerElement}) and its views.
 * MVP: a single Problems view with a placeholder empty-state; the marker tree is
 * a follow-up (it becomes the view's content). Visibility itself is owned by the
 * workbench layout — `AppController` toggles it via commands and keeps this
 * controller's active view in sync.
 */
export class PanelController extends Disposable implements IController {
    public static dependencies = [ThemeServiceDIToken] as const;

    public readonly view: PanelContainerElement;

    public constructor(themeService: ThemeService) {
        super();
        this.view = new PanelContainerElement();
        this.view.addView({
            id: PROBLEMS_VIEW_ID,
            title: "PROBLEMS",
            content: null,
            placeholder: "No problems have been detected in the workspace.",
        });
        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
    }

    public mount(): void {
        // Nothing to wire yet; the marker tree hooks up here in the follow-up.
    }

    public async activate(): Promise<void> {
        // Nothing to load yet.
    }

    /** Makes the Problems view the active tab (used by the "Toggle Problems" command). */
    public showProblems(): void {
        this.view.setActiveView(PROBLEMS_VIEW_ID);
    }

    /** True when the Problems view is the active tab. */
    public isProblemsActive(): boolean {
        return this.view.getActiveViewId() === PROBLEMS_VIEW_ID;
    }

    private applyTheme(theme: WorkbenchTheme): void {
        this.view.background = theme.getRequiredColor("panel.background");
        // Tab labels are drawn dim; the active tab is shown by its underline.
        this.view.titleForeground = theme.getRequiredColor("panelTitle.inactiveForeground");
        this.view.borderColor = theme.getRequiredColor("panel.border");
        this.view.markDirty();
    }
}
