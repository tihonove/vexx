import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { ILogServiceDIToken } from "../Common/Logging/ILogServiceDIToken.ts";
import { LogService } from "../Common/Logging/LogService.ts";
import { RingBufferSink } from "../Common/Logging/sinks/RingBufferSink.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";
import { RingBufferSinkDIToken } from "./Modules/LoggingModule.ts";

describe("AppController — Output view end-to-end", () => {
    let controller: AppController;
    let commands: CommandRegistry;
    let testApp: TestApp;
    let logService: LogService;

    beforeEach(() => {
        // Rebind a real, wired LogService + RingBufferSink (the default profile uses
        // NULL_LOG_SERVICE) so the Output panel has real channels to show — same
        // "rebind before first get(AppController)" trick as the Problems e2e.
        const { container, bindApp } = createTestContainer();
        logService = new LogService();
        const ringBuffer = new RingBufferSink();
        logService.addSink(ringBuffer);
        container.bind(ILogServiceDIToken, () => logService);
        container.bind(RingBufferSinkDIToken, () => ringBuffer);

        logService.createLogger("bootstrap").info("vexx starting");

        controller = container.get(AppControllerDIToken);
        controller.mount();
        testApp = TestApp.create(controller.view, new Size(90, 22));
        bindApp(testApp.app);
        commands = container.get(CommandRegistryDIToken);
    });

    afterEach(() => {
        controller.dispose();
    });

    it("toggles the Output panel, showing the channel selector and log lines", () => {
        commands.execute("workbench.action.output.toggleOutput");
        testApp.render();

        const screen = testApp.backend.screenToString();
        expect(screen).toContain("OUTPUT"); // tab title
        expect(screen).toContain("bootstrap"); // channel dropdown
        expect(screen).toContain("vexx starting"); // log line
    });

    it("hides the panel when Output is already the active view", () => {
        commands.execute("workbench.action.output.toggleOutput");
        testApp.render();
        expect(testApp.backend.screenToString()).toContain("vexx starting");

        commands.execute("workbench.action.output.toggleOutput"); // toggle off
        testApp.render();
        expect(testApp.backend.screenToString()).not.toContain("vexx starting");
    });

    it("live-tails new entries for the active channel", () => {
        commands.execute("workbench.action.output.toggleOutput");
        logService.createLogger("bootstrap").info("second line");
        testApp.render();
        expect(testApp.backend.screenToString()).toContain("second line");
    });

    it("clears the active channel via the Clear Output command", () => {
        commands.execute("workbench.action.output.toggleOutput");
        testApp.render();
        expect(testApp.backend.screenToString()).toContain("vexx starting");

        commands.execute("workbench.output.action.clearOutput");
        testApp.render();
        expect(testApp.backend.screenToString()).not.toContain("vexx starting");
    });
});
