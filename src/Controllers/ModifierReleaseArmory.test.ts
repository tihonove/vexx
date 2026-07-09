import { describe, expect, it, vi } from "vitest";

import { type CommandTrigger, holdModifierOf, ModifierReleaseArmory } from "./ModifierReleaseArmory.ts";

function trigger(mods: Partial<CommandTrigger>): CommandTrigger {
    return { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods };
}

describe("holdModifierOf", () => {
    it("maps Ctrl to Control", () => {
        expect(holdModifierOf(trigger({ ctrlKey: true }))).toBe("Control");
    });

    it("prefers Ctrl over Alt/Meta and ignores Shift", () => {
        expect(holdModifierOf(trigger({ ctrlKey: true, shiftKey: true, altKey: true }))).toBe("Control");
    });

    it("falls back to Alt then Meta", () => {
        expect(holdModifierOf(trigger({ altKey: true }))).toBe("Alt");
        expect(holdModifierOf(trigger({ metaKey: true }))).toBe("Meta");
    });

    it("returns undefined when only Shift (or nothing) is held", () => {
        expect(holdModifierOf(trigger({ shiftKey: true }))).toBeUndefined();
        expect(holdModifierOf(trigger({}))).toBeUndefined();
    });
});

describe("ModifierReleaseArmory", () => {
    it("fires the armed commit when the matching modifier is released", () => {
        const armory = new ModifierReleaseArmory();
        const commit = vi.fn();

        armory.arm("Control", commit);
        armory.fireRelease("Control");

        expect(commit).toHaveBeenCalledTimes(1);
    });

    it("clears the pending commit after firing (release fires at most once)", () => {
        const armory = new ModifierReleaseArmory();
        const commit = vi.fn();

        armory.arm("Control", commit);
        armory.fireRelease("Control");
        armory.fireRelease("Control");

        expect(commit).toHaveBeenCalledTimes(1);
    });

    it("ignores the release of a different modifier, keeping the commit pending", () => {
        const armory = new ModifierReleaseArmory();
        const commit = vi.fn();

        armory.arm("Alt", commit);
        armory.fireRelease("Control");
        expect(commit).not.toHaveBeenCalled();

        armory.fireRelease("Alt");
        expect(commit).toHaveBeenCalledTimes(1);
    });

    it("a new arm overwrites the previous pending commit", () => {
        const armory = new ModifierReleaseArmory();
        const first = vi.fn();
        const second = vi.fn();

        armory.arm("Control", first);
        armory.arm("Alt", second);
        armory.fireRelease("Control"); // old modifier no longer pending
        expect(first).not.toHaveBeenCalled();

        armory.fireRelease("Alt");
        expect(second).toHaveBeenCalledTimes(1);
    });

    it("fireRelease is a no-op when nothing is armed", () => {
        const armory = new ModifierReleaseArmory();
        expect(() => armory.fireRelease("Control")).not.toThrow();
    });
});

describe("armOnHoldRelease within a trigger context", () => {
    it("arms on the current trigger's hold modifier", () => {
        const armory = new ModifierReleaseArmory();
        const commit = vi.fn();

        armory.withTrigger(trigger({ altKey: true }), () => armory.armOnHoldRelease(commit));
        armory.fireRelease("Alt");

        expect(commit).toHaveBeenCalledTimes(1);
    });

    it("does nothing when called outside any trigger context", () => {
        const armory = new ModifierReleaseArmory();
        const commit = vi.fn();

        armory.armOnHoldRelease(commit); // no withTrigger around it
        armory.fireRelease("Control");

        expect(commit).not.toHaveBeenCalled();
    });

    it("does nothing when the trigger has no hold modifier (Shift only)", () => {
        const armory = new ModifierReleaseArmory();
        const commit = vi.fn();

        armory.withTrigger(trigger({ shiftKey: true }), () => armory.armOnHoldRelease(commit));
        armory.fireRelease("Shift");

        expect(commit).not.toHaveBeenCalled();
    });

    it("restores the previous trigger context after nested runs", () => {
        const armory = new ModifierReleaseArmory();
        const outer = vi.fn();
        const inner = vi.fn();

        armory.withTrigger(trigger({ ctrlKey: true }), () => {
            armory.withTrigger(trigger({ altKey: true }), () => armory.armOnHoldRelease(inner));
            // Back in the outer (Ctrl) context after the nested run.
            armory.armOnHoldRelease(outer); // overwrites the inner arm
        });

        armory.fireRelease("Alt"); // inner was overwritten → nothing fires
        expect(inner).not.toHaveBeenCalled();

        armory.fireRelease("Control"); // outer context → fires
        expect(outer).toHaveBeenCalledTimes(1);
    });
});
