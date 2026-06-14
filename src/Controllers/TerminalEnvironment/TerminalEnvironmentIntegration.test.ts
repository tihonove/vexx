import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { Size } from "../../Common/GeometryPromitives.ts";
import { TestApp } from "../../TestUtils/TestApp.ts";
import { AppControllerDIToken } from "../AppController.ts";
import { registerContextKeys } from "../ContextKeys.ts";
import { ContextKeyServiceDIToken } from "../ContextKeyService.ts";
import { TerminalBackendDIToken } from "../CoreTokens.ts";
import { createTestContainer } from "../Modules/TestProfile.ts";
import { StatusBarControllerDIToken } from "../StatusBarController.ts";

import { TerminalEnvironmentServiceDIToken } from "./TerminalEnvironmentService.ts";

describe("Terminal environment integration (context keys + status bar)", () => {
    let savedEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        savedEnv = { ...process.env };
        delete process.env.TMUX;
        delete process.env.SSH_CONNECTION;
        delete process.env.SSH_TTY;
        delete process.env.KITTY_WINDOW_ID;
        process.env.TERM = "xterm-256color";
    });

    afterEach(() => {
        process.env = savedEnv;
    });

    // activate() pushes the synchronously-detected env into context keys and starts the probe.
    async function setup() {
        const { container, bindApp } = createTestContainer();
        const controller = container.get(AppControllerDIToken); // subscribes to env changes
        controller.mount();
        const testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        await controller.activate();
        const contextKeys = container.get(ContextKeyServiceDIToken);
        const statusBar = container.get(StatusBarControllerDIToken);
        const env = container.get(TerminalEnvironmentServiceDIToken);
        const backend = container.get(TerminalBackendDIToken) as MockTerminalBackend;
        return { controller, contextKeys, statusBar, env, backend };
    }

    it("flows a synchronously-detected kitty tier into context keys and the status bar", async () => {
        process.env.TERM = "xterm-kitty"; // extended-keys + graphics hint → kitty (no probe needed)
        const { contextKeys, statusBar } = await setup();

        expect(contextKeys.evaluate("tier == 'kitty'")).toBe(true);
        expect(contextKeys.evaluate("cap_extendedKeys")).toBe(true);
        expect(statusBar.view.getItems()[0]).toEqual({ text: "kitty" });
    });

    it("upgrades the tier (and re-renders) when the fire-and-forget probe confirms support", async () => {
        process.env.TERM = "xterm-256color"; // env says legacy
        const { contextKeys, statusBar, backend } = await setup();

        expect(contextKeys.evaluate("tier == 'legacy'")).toBe(true);
        expect(statusBar.view.getItems()[0]).toEqual({ text: "legacy" });

        // activate() already started the probe; the terminal now confirms keyboard-protocol support.
        backend.resolveKeyboardProtocol(true);

        expect(contextKeys.evaluate("tier == 'legacy'")).toBe(false);
        expect(contextKeys.evaluate("cap_extendedKeys")).toBe(true);
        expect(statusBar.view.getItems()[0]).toEqual({ text: "csi-u" });
    });

    it("reflects a runtime mode toggle in context keys and the status bar", async () => {
        const { contextKeys, statusBar, env } = await setup();

        expect(contextKeys.evaluate("mode_ssh")).toBe(false);
        env.setMode("ssh", true);

        expect(contextKeys.evaluate("mode_ssh")).toBe(true);
        expect(statusBar.view.getItems()[0]).toEqual({ text: "legacy · ssh" });
    });

    it("custom-mode identifiers are valid in when-expressions once registered", async () => {
        registerContextKeys(["mode_presentation"]);
        const { contextKeys } = await setup();
        // Unknown-but-registered key evaluates to false without throwing.
        expect(contextKeys.evaluate("mode_presentation")).toBe(false);
        contextKeys.setRaw("mode_presentation", true);
        expect(contextKeys.evaluate("mode_presentation")).toBe(true);
    });
});
