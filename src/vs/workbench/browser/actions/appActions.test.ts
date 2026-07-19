import { describe, expect, it } from "vitest";

import { registerAction } from "../../../platform/actions/common/commandAction.ts";
import { CommandRegistry } from "../../../platform/commands/common/commandRegistry.ts";
import type { ServiceAccessor } from "../../../platform/instantiation/common/diContainer.ts";
import { Container } from "../../../platform/instantiation/common/diContainer.ts";
import { KeybindingRegistry } from "../../../platform/keybinding/common/keybindingRegistry.ts";

import { type IQuitHandler, quitAction, QuitHandlerDIToken } from "./appActions.ts";

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
