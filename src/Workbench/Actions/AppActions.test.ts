import { afterEach, describe, expect, it, vi } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { Container } from "../../Common/DiContainer.ts";
import { TuiApplication } from "../../TUIDom/TuiApplication.ts";
import { registerAction } from "./CommandAction.ts";
import { CommandRegistry } from "../Services/CommandRegistry.ts";
import { TuiApplicationDIToken } from "../Services/CoreTokens.ts";
import { KeybindingRegistry } from "../Services/KeybindingRegistry.ts";

import { quitAction } from "./AppActions.ts";

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
