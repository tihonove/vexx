import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { ConfigurationModel } from "../../Configuration/ConfigurationModel.ts";
import { ConfigurationService } from "../../Configuration/ConfigurationService.ts";
import { getDefaultConfiguration } from "../../Configuration/defaults.ts";
import type { IConfigurationService } from "../../Configuration/IConfigurationService.ts";

import { TerminalEnvironmentService } from "./TerminalEnvironmentService.ts";

function configFrom(userRaw: Record<string, unknown> = {}): IConfigurationService {
    return new ConfigurationService({
        defaultsLayer: ConfigurationModel.fromRaw(getDefaultConfiguration()),
        userLayer: ConfigurationModel.fromRaw(userRaw),
        profileLayer: ConfigurationModel.EMPTY,
    });
}

describe("TerminalEnvironmentService", () => {
    let savedEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        savedEnv = { ...process.env };
        // Deterministic ambient environment for the constructor's sync detection.
        delete process.env.TMUX;
        delete process.env.SSH_CONNECTION;
        delete process.env.SSH_TTY;
        delete process.env.COLORTERM;
        delete process.env.KITTY_WINDOW_ID;
        delete process.env.GHOSTTY_RESOURCES_DIR;
        delete process.env.WEZTERM_PANE;
        delete process.env.ALACRITTY_WINDOW_ID;
        delete process.env.TERM_PROGRAM;
        process.env.TERM = "xterm-256color";
    });

    afterEach(() => {
        process.env = savedEnv;
    });

    describe("synchronous detection (no probe, no waiting)", () => {
        it("resolves kitty tier immediately from $TERM=xterm-kitty", () => {
            process.env.TERM = "xterm-kitty";
            const service = new TerminalEnvironmentService(new MockTerminalBackend(), configFrom());
            expect(service.tier).toBe("kitty");
            expect(service.hasCapability("extended-keys")).toBe(true);
        });

        it("resolves legacy tier for a plain xterm-256color terminal", () => {
            const service = new TerminalEnvironmentService(new MockTerminalBackend(), configFrom());
            expect(service.tier).toBe("legacy");
            expect(service.hasCapability("extended-keys")).toBe(false);
        });

        it("picks up extended-keys from an env flag even when $TERM is masked (e.g. inside tmux)", () => {
            process.env.TERM = "tmux-256color";
            process.env.KITTY_WINDOW_ID = "1";
            const service = new TerminalEnvironmentService(new MockTerminalBackend(), configFrom());
            // extended-keys via env flag, but no graphics hint → csi-u.
            expect(service.tier).toBe("csi-u");
        });
    });

    describe("fire-and-forget probe (upgrade-only)", () => {
        it("upgrades legacy → csi-u when the probe confirms keyboard-protocol support", () => {
            const backend = new MockTerminalBackend();
            const service = new TerminalEnvironmentService(backend, configFrom());
            let changed = 0;
            service.onDidChange(() => changed++);

            expect(service.tier).toBe("legacy");
            service.detect();
            backend.resolveKeyboardProtocol(true);

            expect(service.hasCapability("extended-keys")).toBe(true);
            expect(service.tier).toBe("csi-u");
            expect(changed).toBe(1);
        });

        it("does nothing when the probe reports no support", () => {
            const backend = new MockTerminalBackend();
            const service = new TerminalEnvironmentService(backend, configFrom());
            let changed = 0;
            service.onDidChange(() => changed++);

            service.detect();
            backend.resolveKeyboardProtocol(false);

            expect(service.tier).toBe("legacy");
            expect(changed).toBe(0);
        });

        it("never downgrades — a non-reply keeps an env-detected capability", () => {
            process.env.TERM = "xterm-kitty";
            const backend = new MockTerminalBackend();
            const service = new TerminalEnvironmentService(backend, configFrom());

            service.detect();
            backend.resolveKeyboardProtocol(false);

            expect(service.tier).toBe("kitty");
        });
    });

    describe("config overrides", () => {
        it("forces the tier regardless of detection", () => {
            const service = new TerminalEnvironmentService(
                new MockTerminalBackend(),
                configFrom({ terminal: { tier: "kitty" } }),
            );
            expect(service.tier).toBe("kitty");
        });

        it("forces a capability off", () => {
            process.env.TERM = "xterm-kitty";
            const service = new TerminalEnvironmentService(
                new MockTerminalBackend(),
                configFrom({ terminal: { capabilities: { osc52: false } } }),
            );
            expect(service.hasCapability("osc52")).toBe(false);
        });
    });

    describe("modes", () => {
        it("forces modes off via config and reports active modes", () => {
            process.env.TMUX = "/tmp/x,1,0";
            const service = new TerminalEnvironmentService(
                new MockTerminalBackend(),
                configFrom({ terminal: { modes: { tmux: false } } }),
            );
            expect(service.isModeActive("tmux")).toBe(false);
            expect(service.isModeActive("local")).toBe(true);
        });

        it("toggles a mode at runtime and notifies listeners", () => {
            const service = new TerminalEnvironmentService(new MockTerminalBackend(), configFrom());
            let fired = 0;
            service.onDidChange(() => fired++);

            expect(service.isModeActive("presentation")).toBe(false);
            service.setMode("presentation", true);
            expect(service.isModeActive("presentation")).toBe(true);
            expect(fired).toBe(1);
        });

        it("exposes declared custom modes for context-key registration", () => {
            const service = new TerminalEnvironmentService(
                new MockTerminalBackend(),
                configFrom({ terminal: { customModes: { presentation: {}, ci: {} } } }),
            );
            expect(service.getKnownModeNames()).toEqual(
                expect.arrayContaining(["local", "ssh", "tmux", "presentation", "ci"]),
            );
        });
    });
});
