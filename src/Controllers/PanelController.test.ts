import { describe, expect, it, vi } from "vitest";

import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import { PanelContainerElement } from "../TUIDom/Widgets/PanelContainerElement.ts";

import { createTestContainer } from "./Modules/TestProfile.ts";
import { PanelController, PanelControllerDIToken, PROBLEMS_VIEW_ID } from "./PanelController.ts";

function makeController(): PanelController {
    return createTestContainer().container.get(PanelControllerDIToken);
}

describe("PanelController", () => {
    it("registers the Problems view and makes it active", () => {
        const controller = makeController();
        expect(controller.view.getViewIds()).toContain(PROBLEMS_VIEW_ID);
        expect(controller.view.getActiveViewId()).toBe(PROBLEMS_VIEW_ID);
        expect(controller.isProblemsActive()).toBe(true);
    });

    it("applies panel colours from the active theme", () => {
        // onThemeChange файрит сразу при подписке (в конструкторе) — ставим шпиона заранее.
        const setStyles = vi.spyOn(PanelContainerElement.prototype, "setStyles");
        const { container } = createTestContainer();
        container.get(PanelControllerDIToken);
        const theme = container.get(ThemeServiceDIToken).theme;
        expect(setStyles).toHaveBeenCalledWith({
            background: theme.getRequiredColor("panel.background"),
            titleForeground: theme.getRequiredColor("panelTitle.inactiveForeground"),
            borderColor: theme.getRequiredColor("panel.border"),
        });
        setStyles.mockRestore();
    });

    it("reflects and restores the active-view state", () => {
        const controller = makeController();
        controller.view.addView({ id: "other", title: "OUTPUT", content: null });
        controller.view.setActiveView("other");
        expect(controller.isProblemsActive()).toBe(false);

        controller.showProblems();
        expect(controller.isProblemsActive()).toBe(true);
    });

    it("mounts and activates without side effects", async () => {
        const controller = makeController();
        controller.mount();
        await expect(controller.activate()).resolves.toBeUndefined();
    });
});
