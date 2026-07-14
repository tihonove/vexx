import { describe, expect, it } from "vitest";

import { ThemeServiceDIToken } from "../../../services/themes/common/themeTokens.ts";

import { createTestContainer } from "../../../../vexx/modules/testProfile.ts";
import { PanelController, PanelControllerDIToken, PROBLEMS_VIEW_ID } from "./panelController.ts";

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
        const { container } = createTestContainer();
        const controller = container.get(PanelControllerDIToken);
        const theme = container.get(ThemeServiceDIToken).theme;
        expect(controller.view.background).toBe(theme.getRequiredColor("panel.background"));
        expect(controller.view.titleForeground).toBe(theme.getRequiredColor("panelTitle.inactiveForeground"));
        expect(controller.view.borderColor).toBe(theme.getRequiredColor("panel.border"));
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
