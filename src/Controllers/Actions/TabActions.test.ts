import { describe, expect, it, vi } from "vitest";

import { Container } from "../../Common/DiContainer.ts";
import { CommandRegistry } from "../CommandRegistry.ts";
import { registerAction } from "../CommandAction.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { KeybindingRegistry } from "../KeybindingRegistry.ts";
import {
    closeActiveEditorAction,
    nextEditorInGroupAction,
    previousEditorInGroupAction,
} from "./TabActions.ts";

interface GroupStub {
    activeIndex: number;
    editorCount: number;
    activateTab: (index: number) => void;
    closeTab: (index: number) => void;
}

function setupActionTest(group: GroupStub) {
    const commands = new CommandRegistry();
    const keybindings = new KeybindingRegistry();
    const accessor = new Container();
    accessor.bind(EditorGroupControllerDIToken, () => group as never);
    return { commands, keybindings, accessor };
}

describe("TabActions", () => {
    it("nextEditorInGroup cycles from last tab to first", () => {
        const activateTab = vi.fn();
        const group: GroupStub = {
            activeIndex: 2,
            editorCount: 3,
            activateTab,
            closeTab: vi.fn(),
        };

        const { commands, keybindings, accessor } = setupActionTest(group);
        registerAction(commands, keybindings, accessor, nextEditorInGroupAction);

        commands.execute("workbench.action.nextEditorInGroup");

        expect(activateTab).toHaveBeenCalledWith(0);
    });

    it("previousEditorInGroup cycles from first tab to last", () => {
        const activateTab = vi.fn();
        const group: GroupStub = {
            activeIndex: 0,
            editorCount: 3,
            activateTab,
            closeTab: vi.fn(),
        };

        const { commands, keybindings, accessor } = setupActionTest(group);
        registerAction(commands, keybindings, accessor, previousEditorInGroupAction);

        commands.execute("workbench.action.previousEditorInGroup");

        expect(activateTab).toHaveBeenCalledWith(2);
    });

    it("nextEditorInGroup is noop when there is one tab", () => {
        const activateTab = vi.fn();
        const group: GroupStub = {
            activeIndex: 0,
            editorCount: 1,
            activateTab,
            closeTab: vi.fn(),
        };

        const { commands, keybindings, accessor } = setupActionTest(group);
        registerAction(commands, keybindings, accessor, nextEditorInGroupAction);

        commands.execute("workbench.action.nextEditorInGroup");

        expect(activateTab).not.toHaveBeenCalled();
    });

    it("closeActiveEditor closes currently active tab", () => {
        const closeTab = vi.fn();
        const group: GroupStub = {
            activeIndex: 1,
            editorCount: 3,
            activateTab: vi.fn(),
            closeTab,
        };

        const { commands, keybindings, accessor } = setupActionTest(group);
        registerAction(commands, keybindings, accessor, closeActiveEditorAction);

        commands.execute("workbench.action.closeActiveEditor");

        expect(closeTab).toHaveBeenCalledWith(1);
    });
});
