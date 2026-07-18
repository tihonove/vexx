import { describe, expect, it } from "vitest";

import { ThemeService } from "../Theme/ThemeService.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { TUIElement } from "../TUIDom/TUIElement.ts";

import { Component } from "./Component.ts";

class BareComponent extends Component {
    public readonly view = new TUIElement();

    public constructor(themeService: ThemeService) {
        super(themeService);
    }
}

class StyledComponent extends BareComponent {
    public applied: WorkbenchTheme[] = [];

    protected override applyStyles(theme: WorkbenchTheme): void {
        this.applied.push(theme);
    }
}

function makeService(): ThemeService {
    return new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
}

describe("Component (база Workbench)", () => {
    it("mount подписывается на тему и сразу применяет текущую", () => {
        const service = makeService();
        const component = new StyledComponent(service);

        expect(component.applied.length).toBe(0);
        component.mount();
        expect(component.applied.length).toBe(1);
        expect(component.applied[0]).toBe(service.theme);
    });

    it("смена темы после mount снова зовёт applyStyles", () => {
        const service = makeService();
        const component = new StyledComponent(service);
        component.mount();

        service.setTheme(service.theme);

        expect(component.applied.length).toBe(2);
    });

    it("dispose отписывает от темы", () => {
        const service = makeService();
        const component = new StyledComponent(service);
        component.mount();
        component.dispose();

        service.setTheme(service.theme);

        expect(component.applied.length).toBe(1);
    });

    it("база без переопределений: applyStyles — no-op, activate резолвится", async () => {
        const service = makeService();
        const component = new BareComponent(service);
        component.mount();

        await expect(component.activate()).resolves.toBeUndefined();
    });
});
