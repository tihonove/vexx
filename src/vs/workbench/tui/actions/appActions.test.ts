import { afterEach, describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../../../tui/backend/mockTerminalBackend.ts";
import { Container } from "../../../platform/instantiation/common/instantiation.ts";
import { TuiApplication } from "../../../base/tui/tuiApplication.ts";
import { registerAction } from "../../../platform/commands/common/commandAction.ts";
import { CommandRegistry } from "../../../platform/commands/common/commands.ts";
import { TuiApplicationDIToken } from "../coreTokens.ts";
import { KeybindingRegistry } from "../../../platform/keybinding/common/keybindingsRegistry.ts";

import { quitAction } from "./appActions.ts";

describe("AppActions — quit", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("tears down the backend and exits the process", () => {
        const backend = new MockTerminalBackend();
        const teardown = vi.spyOn(backend, "teardown");
        // Stop execution at process.exit without actually killing the test runner.
        const exit = vi.spyOn(process, "exit").mockImplementation(((): never => {
            throw new Error("__exit__");
        }) as never);

        const app = new TuiApplication(backend);
        const accessor = new Container();
        accessor.bind(TuiApplicationDIToken, () => app);
        const commands = new CommandRegistry();
        registerAction(commands, new KeybindingRegistry(), accessor, quitAction);

        expect(() => commands.execute(quitAction.id)).toThrow("__exit__");

        expect(teardown).toHaveBeenCalledTimes(1);
        expect(exit).toHaveBeenCalledWith(0);
    });
});
