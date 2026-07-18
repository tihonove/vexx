import { describe, expect, it } from "vitest";

import type { ServiceAccessor } from "../../Common/DiContainer.ts";
import { Container } from "../../Common/DiContainer.ts";
import { CommandRegistry } from "../Services/CommandRegistry.ts";
import { KeybindingRegistry } from "../Services/KeybindingRegistry.ts";

import { type IQuitHandler, quitAction, QuitHandlerDIToken } from "./AppActions.ts";
import { registerAction } from "./CommandAction.ts";

describe("AppActions — quit", () => {
    it("делегирует выход в QuitHandler (WorkbenchComponent.requestQuit)", () => {
        const calls: ServiceAccessor[] = [];
        const quitHandler: IQuitHandler = {
            requestQuit: (accessor) => {
                calls.push(accessor);
            },
        };
        const accessor = new Container();
        accessor.bind(QuitHandlerDIToken, () => quitHandler);
        const commands = new CommandRegistry();
        registerAction(commands, new KeybindingRegistry(), accessor, quitAction);

        commands.execute(quitAction.id);

        expect(calls).toEqual([accessor]);
    });
});
