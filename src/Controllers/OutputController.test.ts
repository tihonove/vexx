import { describe, expect, it } from "vitest";

import { LogService } from "../Common/Logging/LogService.ts";
import { RingBufferSink } from "../Common/Logging/sinks/RingBufferSink.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";

import { createTestContainer } from "./Modules/TestProfile.ts";
import { OutputController } from "./OutputController.ts";
import { PanelController, PanelControllerDIToken, OUTPUT_VIEW_ID } from "./PanelController.ts";

function build() {
    const { container } = createTestContainer();
    const panel = container.get(PanelControllerDIToken);
    const themeService = container.get(ThemeServiceDIToken);

    const logService = new LogService();
    const ringBuffer = new RingBufferSink();
    logService.addSink(ringBuffer);

    return { panel, themeService, logService, ringBuffer };
}

function channels(controller: OutputController): string[] {
    return controller.dropdown.options.map((o) => o.value);
}

describe("OutputController", () => {
    it("on mount selects the first channel and loads its history", () => {
        const { panel, themeService, logService, ringBuffer } = build();
        logService.createLogger("alpha").info("a1");
        logService.createLogger("alpha").info("a2");
        logService.createLogger("beta").info("b1");

        const controller = new OutputController(ringBuffer, logService, panel, themeService);
        controller.mount();

        expect(controller.dropdown.value).toBe("alpha");
        expect(channels(controller)).toEqual(["alpha", "beta"]);
        expect(controller.view.contentHeight).toBe(2);
        // Content + header control are injected into the OUTPUT view.
        expect(panel.view.getViewIds()).toContain(OUTPUT_VIEW_ID);
    });

    it("switching channel via the dropdown reloads that channel's entries", () => {
        const { panel, themeService, logService, ringBuffer } = build();
        logService.createLogger("alpha").info("a1");
        logService.createLogger("beta").info("b1");
        logService.createLogger("beta").info("b2");

        const controller = new OutputController(ringBuffer, logService, panel, themeService);
        controller.mount();
        expect(controller.view.contentHeight).toBe(1); // alpha

        // Simulate a user pick from the channel dropdown.
        controller.dropdown.onChange?.("beta");

        expect(controller.dropdown.value).toBe("beta");
        expect(controller.view.contentHeight).toBe(2); // beta
    });

    it("live-appends only entries for the active channel", () => {
        const { panel, themeService, logService, ringBuffer } = build();
        logService.createLogger("alpha").info("a1");

        const controller = new OutputController(ringBuffer, logService, panel, themeService);
        controller.mount();
        expect(controller.view.contentHeight).toBe(1);

        logService.createLogger("beta").info("b1"); // other channel — ignored by the view
        expect(controller.view.contentHeight).toBe(1);

        logService.createLogger("alpha").info("a2"); // active channel — appended
        expect(controller.view.contentHeight).toBe(2);
    });

    it("surfaces a channel first seen at runtime in the selector", () => {
        const { panel, themeService, logService, ringBuffer } = build();
        logService.createLogger("alpha").info("a1");

        const controller = new OutputController(ringBuffer, logService, panel, themeService);
        controller.mount();
        expect(channels(controller)).toEqual(["alpha"]);

        logService.createLogger("gamma").info("g1");
        expect(channels(controller)).toContain("gamma");
    });

    it("adopts the first channel when it starts empty", () => {
        const { panel, themeService, logService, ringBuffer } = build();
        const controller = new OutputController(ringBuffer, logService, panel, themeService);
        controller.mount();
        expect(controller.dropdown.value).toBeNull();

        logService.createLogger("alpha").info("first");
        expect(controller.dropdown.value).toBe("alpha");
        expect(controller.view.contentHeight).toBe(1);
    });

    it("clear empties the active channel's buffer and the view", () => {
        const { panel, themeService, logService, ringBuffer } = build();
        logService.createLogger("alpha").info("a1");

        const controller = new OutputController(ringBuffer, logService, panel, themeService);
        controller.mount();
        expect(controller.view.contentHeight).toBe(1);

        controller.clear();

        expect(controller.view.contentHeight).toBe(0);
        expect(ringBuffer.getEntries("alpha")).toEqual([]);
    });

    it("clear is a no-op when no channel is active", () => {
        const { panel, themeService, logService, ringBuffer } = build();
        const controller = new OutputController(ringBuffer, logService, panel, themeService);
        controller.mount(); // empty buffer → activeChannel stays null
        expect(() => controller.clear()).not.toThrow();
        expect(controller.view.contentHeight).toBe(0);
    });

    it("is a PanelController-driven headless controller (no own view)", () => {
        const { panel } = build();
        expect(panel).toBeInstanceOf(PanelController);
    });
});
