import { describe, expect, it, vi } from "vitest";

import { Container, token } from "../Common/DiContainer.ts";

import type { CommandAction } from "./CommandAction.ts";
import { registerAction } from "./CommandAction.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import type { KeyboardEventLike } from "./KeybindingRegistry.ts";
import { KeybindingRegistry, parseChord, parseKeybinding } from "./KeybindingRegistry.ts";

// Maps the structured resolveKey result to a command id (or undefined).
function resolve(keybindings: KeybindingRegistry, event: KeyboardEventLike): string | undefined {
    const res = keybindings.resolveKey(event);
    return res.kind === "command" ? res.commandId : undefined;
}

describe("registerAction", () => {
    it("registers command handler in CommandRegistry", () => {
        const commands = new CommandRegistry();
        const keybindings = new KeybindingRegistry();
        const accessor = new Container();
        const action: CommandAction = {
            id: "test.action",
            title: "Test Action",
            run: vi.fn(),
        };

        registerAction(commands, keybindings, accessor, action);

        expect(commands.has("test.action")).toBe(true);
    });

    it("passes accessor to run when command executes", () => {
        const commands = new CommandRegistry();
        const keybindings = new KeybindingRegistry();
        const accessor = new Container();
        const runFn = vi.fn();
        const action: CommandAction = {
            id: "test.action",
            title: "Test Action",
            run: runFn,
        };

        registerAction(commands, keybindings, accessor, action);
        commands.execute("test.action");

        expect(runFn).toHaveBeenCalledWith(accessor);
    });

    it("forwards extra args to run", () => {
        const commands = new CommandRegistry();
        const keybindings = new KeybindingRegistry();
        const accessor = new Container();
        const runFn = vi.fn();
        const action: CommandAction = {
            id: "test.action",
            title: "Test Action",
            run: runFn,
        };

        registerAction(commands, keybindings, accessor, action);
        commands.execute("test.action", "arg1", 42);

        expect(runFn).toHaveBeenCalledWith(accessor, "arg1", 42);
    });

    it("registers keybinding when specified", () => {
        const commands = new CommandRegistry();
        const keybindings = new KeybindingRegistry();
        const accessor = new Container();
        const action: CommandAction = {
            id: "test.action",
            title: "Test Action",
            keybinding: parseKeybinding("ctrl+s"),
            run: vi.fn(),
        };

        registerAction(commands, keybindings, accessor, action);

        const resolved = resolve(keybindings, {
            key: "s",
            ctrlKey: true,
            shiftKey: false,
            altKey: false,
            metaKey: false,
        });
        expect(resolved).toBe("test.action");
    });

    it("registers all keybindings when keybindings array is specified", () => {
        const commands = new CommandRegistry();
        const keybindings = new KeybindingRegistry();
        const accessor = new Container();
        const action: CommandAction = {
            id: "test.action",
            title: "Test Action",
            keybindings: [parseKeybinding("ctrl+s"), parseKeybinding("ctrl+pagedown")],
            run: vi.fn(),
        };

        registerAction(commands, keybindings, accessor, action);

        const resolvedCtrlS = resolve(keybindings, {
            key: "s",
            ctrlKey: true,
            shiftKey: false,
            altKey: false,
            metaKey: false,
        });
        expect(resolvedCtrlS).toBe("test.action");

        const resolvedCtrlPageDown = resolve(keybindings, {
            key: "PageDown",
            ctrlKey: true,
            shiftKey: false,
            altKey: false,
            metaKey: false,
        });
        expect(resolvedCtrlPageDown).toBe("test.action");
    });

    it("registers a chord binding that resolves across two key presses", () => {
        const commands = new CommandRegistry();
        const keybindings = new KeybindingRegistry();
        const accessor = new Container();
        const action: CommandAction = {
            id: "test.action",
            title: "Test Action",
            keybindings: [parseChord("ctrl+k s")],
            run: vi.fn(),
        };

        registerAction(commands, keybindings, accessor, action);

        const first = keybindings.resolveKey({
            key: "k",
            ctrlKey: true,
            shiftKey: false,
            altKey: false,
            metaKey: false,
        });
        expect(first.kind).toBe("chord");

        const second = keybindings.resolveKey({
            key: "s",
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            metaKey: false,
        });
        expect(second).toEqual({ kind: "command", commandId: "test.action" });
    });

    it("does not register keybinding when not specified", () => {
        const commands = new CommandRegistry();
        const keybindings = new KeybindingRegistry();
        const accessor = new Container();
        const action: CommandAction = {
            id: "test.action",
            title: "Test Action",
            run: vi.fn(),
        };

        registerAction(commands, keybindings, accessor, action);

        const resolved = resolve(keybindings, {
            key: "s",
            ctrlKey: true,
            shiftKey: false,
            altKey: false,
            metaKey: false,
        });
        expect(resolved).toBeUndefined();
    });

    it("dispose removes command and keybinding", () => {
        const commands = new CommandRegistry();
        const keybindings = new KeybindingRegistry();
        const accessor = new Container();
        const action: CommandAction = {
            id: "test.action",
            title: "Test Action",
            keybinding: parseKeybinding("ctrl+s"),
            run: vi.fn(),
        };

        const disposable = registerAction(commands, keybindings, accessor, action);
        disposable.dispose();

        expect(commands.has("test.action")).toBe(false);
        const resolved = resolve(keybindings, {
            key: "s",
            ctrlKey: true,
            shiftKey: false,
            altKey: false,
            metaKey: false,
        });
        expect(resolved).toBeUndefined();
    });

    it("run can access services via accessor", () => {
        const MyServiceToken = token<{ value: string }>("MyService");
        const container = new Container();
        container.bind(MyServiceToken, () => ({ value: "hello" }));

        const commands = new CommandRegistry();
        const keybindings = new KeybindingRegistry();
        const action: CommandAction = {
            id: "test.action",
            title: "Test Action",
            run(accessor) {
                return accessor.get(MyServiceToken).value;
            },
        };

        registerAction(commands, keybindings, container, action);
        const result = commands.execute("test.action");

        expect(result).toBe("hello");
    });
});
