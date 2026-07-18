import { describe, expect, it, vi } from "vitest";

import { Container } from "../../Common/DiContainer.ts";
import { registerAction } from "../CommandAction.ts";
import { CommandRegistry } from "../../Workbench/Services/CommandRegistry.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";
import { KeybindingRegistry } from "../../Workbench/Services/KeybindingRegistry.ts";
import { ModifierReleaseArmory, ModifierReleaseArmoryDIToken } from "../../Workbench/Services/ModifierReleaseArmory.ts";

import { closeActiveEditorAction, nextEditorInGroupAction, previousEditorInGroupAction } from "./TabActions.ts";

interface GroupStub {
    activeIndex: number;
    editorCount: number;
    activateTab: (index: number) => void;
    cycleMru?: (direction: 1 | -1) => void;
    endMruCycle?: () => void;
    closeTab: (index: number) => void;
    getActiveEditor?: () => { isModified: boolean } | null;
    onRequestConfirmClose?: (index: number) => void;
}

function setupActionTest(group: GroupStub) {
    const commands = new CommandRegistry();
    const keybindings = new KeybindingRegistry();
    const accessor = new Container();
    const armory = new ModifierReleaseArmory();
    accessor.bind(EditorGroupControllerDIToken, () => group as never);
    accessor.bind(ModifierReleaseArmoryDIToken, () => armory);
    return { commands, keybindings, accessor, armory };
}

describe("TabActions", () => {
    it("nextEditorInGroup steps forward through the MRU stack", () => {
        const cycleMru = vi.fn();
        const group: GroupStub = {
            activeIndex: 2,
            editorCount: 3,
            activateTab: vi.fn(),
            cycleMru,
            closeTab: vi.fn(),
        };

        const { commands, keybindings, accessor } = setupActionTest(group);
        registerAction(commands, keybindings, accessor, nextEditorInGroupAction);

        commands.execute("workbench.action.nextEditorInGroup");

        expect(cycleMru).toHaveBeenCalledWith(1);
    });

    it("previousEditorInGroup steps backward through the MRU stack", () => {
        const cycleMru = vi.fn();
        const group: GroupStub = {
            activeIndex: 0,
            editorCount: 3,
            activateTab: vi.fn(),
            cycleMru,
            closeTab: vi.fn(),
        };

        const { commands, keybindings, accessor } = setupActionTest(group);
        registerAction(commands, keybindings, accessor, previousEditorInGroupAction);

        commands.execute("workbench.action.previousEditorInGroup");

        expect(cycleMru).toHaveBeenCalledWith(-1);
    });

    it("arms the trigger's hold modifier so releasing it commits the MRU cycle", () => {
        const endMruCycle = vi.fn();
        const group: GroupStub = {
            activeIndex: 0,
            editorCount: 3,
            activateTab: vi.fn(),
            cycleMru: vi.fn(),
            endMruCycle,
            closeTab: vi.fn(),
        };

        const { commands, keybindings, accessor, armory } = setupActionTest(group);
        registerAction(commands, keybindings, accessor, nextEditorInGroupAction);

        // Triggered by Ctrl+Tab → runs inside a Control trigger context → arms on Control release.
        armory.withTrigger({ ctrlKey: true, shiftKey: false, altKey: false, metaKey: false }, () => {
            commands.execute("workbench.action.nextEditorInGroup");
        });
        expect(endMruCycle).not.toHaveBeenCalled();

        armory.fireRelease("Control");
        expect(endMruCycle).toHaveBeenCalledTimes(1);
    });

    it("does not arm a hold session when invoked without a modifier (e.g. from a menu)", () => {
        const endMruCycle = vi.fn();
        const group: GroupStub = {
            activeIndex: 0,
            editorCount: 3,
            activateTab: vi.fn(),
            cycleMru: vi.fn(),
            endMruCycle,
            closeTab: vi.fn(),
        };

        const { commands, keybindings, accessor, armory } = setupActionTest(group);
        registerAction(commands, keybindings, accessor, previousEditorInGroupAction);

        commands.execute("workbench.action.previousEditorInGroup"); // no trigger

        armory.fireRelease("Control");
        expect(endMruCycle).not.toHaveBeenCalled();
    });

    it("closeActiveEditor closes currently active tab", () => {
        const closeTab = vi.fn();
        const group: GroupStub = {
            activeIndex: 1,
            editorCount: 3,
            activateTab: vi.fn(),
            closeTab,
            getActiveEditor: () => ({ isModified: false }),
        };

        const { commands, keybindings, accessor } = setupActionTest(group);
        registerAction(commands, keybindings, accessor, closeActiveEditorAction);

        commands.execute("workbench.action.closeActiveEditor");

        expect(closeTab).toHaveBeenCalledWith(1);
    });

    it("closeActiveEditor routes a modified editor through the confirm-close dialog", () => {
        const closeTab = vi.fn();
        const onRequestConfirmClose = vi.fn();
        const group: GroupStub = {
            activeIndex: 2,
            editorCount: 3,
            activateTab: vi.fn(),
            closeTab,
            getActiveEditor: () => ({ isModified: true }),
            onRequestConfirmClose,
        };

        const { commands, keybindings, accessor } = setupActionTest(group);
        registerAction(commands, keybindings, accessor, closeActiveEditorAction);

        commands.execute("workbench.action.closeActiveEditor");

        expect(onRequestConfirmClose).toHaveBeenCalledWith(2);
        expect(closeTab).not.toHaveBeenCalled();
    });

    it("closeActiveEditor closes directly when modified but no confirm handler is wired", () => {
        const closeTab = vi.fn();
        const group: GroupStub = {
            activeIndex: 0,
            editorCount: 1,
            activateTab: vi.fn(),
            closeTab,
            getActiveEditor: () => ({ isModified: true }),
            // onRequestConfirmClose intentionally absent → else branch.
        };

        const { commands, keybindings, accessor } = setupActionTest(group);
        registerAction(commands, keybindings, accessor, closeActiveEditorAction);

        commands.execute("workbench.action.closeActiveEditor");

        expect(closeTab).toHaveBeenCalledWith(0);
    });

    it("closeActiveEditor is a no-op when the group is empty", () => {
        const closeTab = vi.fn();
        const group: GroupStub = {
            activeIndex: -1,
            editorCount: 0,
            activateTab: vi.fn(),
            closeTab,
            getActiveEditor: () => null,
        };

        const { commands, keybindings, accessor } = setupActionTest(group);
        registerAction(commands, keybindings, accessor, closeActiveEditorAction);

        commands.execute("workbench.action.closeActiveEditor");

        expect(closeTab).not.toHaveBeenCalled();
    });
});
