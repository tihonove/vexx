import { describe, expect, it, vi } from "vitest";

import { CommandRegistry } from "./CommandRegistry.ts";

describe("CommandRegistry", () => {
    it("executes a registered command", () => {
        const registry = new CommandRegistry();
        const handler = vi.fn();
        registry.register("test.command", handler);

        registry.execute("test.command");

        expect(handler).toHaveBeenCalledOnce();
    });

    it("passes arguments to the handler", () => {
        const registry = new CommandRegistry();
        const handler = vi.fn();
        registry.register("test.command", handler);

        registry.execute("test.command", "arg1", 42);

        expect(handler).toHaveBeenCalledWith("arg1", 42);
    });

    it("returns handler result", () => {
        const registry = new CommandRegistry();
        registry.register("test.command", () => "result");

        const result = registry.execute("test.command");

        expect(result).toBe("result");
    });

    it("returns undefined for unknown command", () => {
        const registry = new CommandRegistry();

        const result = registry.execute("unknown.command");

        expect(result).toBeUndefined();
    });

    it("has() returns true for registered command", () => {
        const registry = new CommandRegistry();
        registry.register("test.command", () => {
            /* noop */
        });

        expect(registry.has("test.command")).toBe(true);
    });

    it("has() returns false for unregistered command", () => {
        const registry = new CommandRegistry();

        expect(registry.has("test.command")).toBe(false);
    });

    it("unregisters command via returned disposable", () => {
        const registry = new CommandRegistry();
        const disposable = registry.register("test.command", () => {
            /* noop */
        });

        disposable.dispose();

        expect(registry.has("test.command")).toBe(false);
    });

    it("disposable does not remove a re-registered handler", () => {
        const registry = new CommandRegistry();
        const disposable = registry.register("test.command", () => "old");
        registry.register("test.command", () => "new");

        disposable.dispose();

        expect(registry.has("test.command")).toBe(true);
        expect(registry.execute("test.command")).toBe("new");
    });

    it("dispose() clears all handlers", () => {
        const registry = new CommandRegistry();
        registry.register("cmd.a", () => {
            /* noop */
        });
        registry.register("cmd.b", () => {
            /* noop */
        });

        registry.dispose();

        expect(registry.has("cmd.a")).toBe(false);
        expect(registry.has("cmd.b")).toBe(false);
    });
});
